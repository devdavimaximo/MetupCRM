using Metup.Application.Common.Interfaces;
using Metup.Application.Integrations.Commands.FinishLeadSearch;
using Metup.Application.Integrations.Commands.ReceiveLeadSearchResults;
using Metup.Application.Integrations.Commands.StartAutomationLeadSearch;
using Metup.Application.LeadFinder.Commands.ImportFoundLeads;
using Metup.Application.LeadFinder.Commands.RequestLeadSearch;
using Metup.Application.LeadFinder.Commands.TriageFoundLeads;
using Metup.Application.LeadFinder.Queries.ListFoundLeads;
using Metup.Domain.Activities;
using Metup.Domain.Companies;
using Metup.Domain.Deals;
using Metup.Domain.Integrations;
using Metup.Domain.LeadFinder;
using Metup.Domain.Organizations;
using Metup.Domain.Users;
using Metup.Infrastructure.Persistence;
using Metup.Infrastructure.Search;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Metup.Integration.Tests.LeadFinder;

/// <summary>
/// Buscador de leads contra Postgres real: o casamento por telefone é SQL cru com índice de expressão
/// e a busca de texto usa <c>unaccent</c> — nada disso o provedor em memória reproduz. Cada teste
/// monta a própria organização, então a ordem não importa.
/// </summary>
public class LeadFinderTests(LeadFinderDatabase fixture) : IClassFixture<LeadFinderDatabase>
{
    private static readonly TimeZoneInfo SaoPaulo = TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo");

    [Fact]
    public async Task Ingestao_deduplica_no_lote_e_no_reenvio_e_casa_empresa_ja_cadastrada_pelo_telefone()
    {
        var org = await fixture.NewOrganizationAsync();
        await using (var db = fixture.Database.Open(org.Id))
        {
            db.Companies.Add(new Company { OrganizationId = org.Id, Name = "Sorriso Já Cliente", Phone = "(41) 3333-4444" });
            await db.SaveChangesAsync();
        }

        var search = await RequestAsync(org, "clínicas odontológicas", "Curitiba, PR");

        IncomingLead[] batch =
        [
            Lead("Clínica Sorriso", phone: "+55 41 3333-4444", placeId: "p1"),       // casa a empresa existente
            Lead("Odonto Vida", phone: "41 99999-0001", placeId: "p2", website: "odontovida.com.br"),
            Lead("Odonto Vida (filial)", phone: "(41) 99999-0001", placeId: "p3"),   // mesmo telefone → mesmo lead
            Lead("Dentista Sem Fone", placeId: "p4"),
            Lead("   ", placeId: "p5"),                                              // sem nome → rejeitado
        ];

        var first = await IngestAsync(org, search, batch);
        Assert.Equal(5, first.Received);
        Assert.Equal(3, first.Inserted);
        Assert.Equal(1, first.Duplicates);
        Assert.Equal(1, first.Rejected);
        Assert.Equal(LeadSearchStatus.Running, first.Status);

        // O n8n reenviou o mesmo lote: nada novo.
        var resend = await IngestAsync(org, search, batch);
        Assert.Equal(0, resend.Inserted);
        Assert.Equal(4, resend.Duplicates);

        await using var check = fixture.Database.Open(org.Id);
        var leads = await check.FoundLeads.OrderBy(l => l.Name).ToListAsync();
        Assert.Equal(["Clínica Sorriso", "Dentista Sem Fone", "Odonto Vida"], leads.Select(l => l.Name));

        var existingCompanyId = await check.Companies.Where(c => c.Name == "Sorriso Já Cliente").Select(c => c.Id).SingleAsync();
        Assert.Equal(existingCompanyId, leads[0].ExistingCompanyId);
        Assert.Null(leads[2].ExistingCompanyId);
        Assert.Equal("https://odontovida.com.br", leads[2].Website);

        // O reenvio não infla "encontrados": a busca achou 3 lugares distintos.
        var saved = await check.LeadSearches.SingleAsync(s => s.Id == search);
        Assert.Equal(3, saved.ReceivedCount);
        Assert.Equal(3, saved.NewCount);

        // Outra busca que acha os mesmos lugares: encontrou 3, nenhum novo.
        var second = await RequestAsync(org, "dentistas", "Curitiba");
        await IngestAsync(org, second, batch);
        await using var recheck = fixture.Database.Open(org.Id);
        var secondSaved = await recheck.LeadSearches.SingleAsync(s => s.Id == second);
        Assert.Equal(3, secondSaved.ReceivedCount);
        Assert.Equal(0, secondSaved.NewCount);
    }

    [Fact]
    public async Task Busca_cancelada_nao_recebe_resultados_e_fim_repetido_e_inofensivo()
    {
        var org = await fixture.NewOrganizationAsync();
        var search = await RequestAsync(org, "academias", "Joinville");

        await using (var db = fixture.Database.Open(org.Id))
        {
            (await db.LeadSearches.SingleAsync(s => s.Id == search)).Cancel(DateTime.UtcNow);
            await db.SaveChangesAsync();
        }

        var result = await IngestAsync(org, search, [Lead("Academia Força", phone: "47 3000-1000")]);
        Assert.Equal(0, result.Inserted);
        Assert.Equal(LeadSearchStatus.Cancelled, result.Status);

        var automation = await StartFromAutomationAsync(org, "exec-42", "pet shops");
        var again = await StartFromAutomationAsync(org, "exec-42", "pet shops");
        Assert.Equal(automation, again);

        await FinishAsync(org, automation, success: false, "Cota da API de mapas esgotada.");
        var finished = await FinishAsync(org, automation, success: true, null);
        Assert.Equal(LeadSearchStatus.Failed, finished.Status);
        Assert.Equal("Cota da API de mapas esgotada.", finished.ErrorMessage);
    }

    [Fact]
    public async Task Busca_so_sem_site_descarta_no_recebimento_quem_tem_site_e_avisa_o_n8n()
    {
        var org = await fixture.NewOrganizationAsync();
        var search = await RequestAsync(org, "pet shops", "Londrina", withoutWebsite: true);

        var result = await IngestAsync(org, search,
        [
            Lead("Pet Amigo", phone: "43 3000-0001"),
            Lead("Pet Center", phone: "43 3000-0002", website: "petcenter.com.br"),
            Lead("Bicho Feliz", phone: "43 3000-0003", website: "javascript:alert(1)"), // site inválido = sem site
        ]);

        Assert.Equal(2, result.Inserted);
        Assert.Equal(1, result.Filtered);

        await using var check = fixture.Database.Open(org.Id);
        Assert.Equal(["Bicho Feliz", "Pet Amigo"], await check.FoundLeads.OrderBy(l => l.Name).Select(l => l.Name).ToListAsync());
        Assert.True((await check.LeadSearches.SingleAsync(s => s.Id == search)).WithoutWebsite);

        var requested = await check.IntegrationEvents.SingleAsync(e => e.Type == IntegrationEventTypes.LeadSearchRequested);
        using var payload = System.Text.Json.JsonDocument.Parse(requested.Payload);
        Assert.True(payload.RootElement.GetProperty("filters").GetProperty("withoutWebsite").GetBoolean());
    }

    [Fact]
    public async Task Lista_filtra_sem_site_busca_sem_acento_ordena_nota_com_nulos_no_fim_e_conta_por_situacao()
    {
        var org = await fixture.NewOrganizationAsync();
        var search = await RequestAsync(org, "restaurantes", "São Paulo");
        await IngestAsync(org, search,
        [
            Lead("Cantina São Jorge", phone: "11 3000-0001", rating: 4.2m, reviews: 80),
            Lead("Bistrô Paulista", phone: "11 3000-0002", rating: 4.8m, reviews: 300, website: "bistro.com"),
            Lead("Bar do Zé", phone: "11 3000-0003", rating: null),
            Lead("Pizzaria Bella", phone: "11 3000-0004", rating: 4.8m, reviews: 1200),
        ]);

        var all = await ListAsync(org, new ListFoundLeadsQuery(search, FoundLeadStatus.New, null, null, null, null, FoundLeadSort.Rating, 1, 50));
        Assert.Equal(["Pizzaria Bella", "Bistrô Paulista", "Cantina São Jorge", "Bar do Zé"], all.Items.Select(l => l.Name));
        Assert.Equal(new(4, 0, 0), all.Counts);

        var withoutSite = await ListAsync(org, new ListFoundLeadsQuery(search, FoundLeadStatus.New, null, null, false, null, FoundLeadSort.Name, 1, 50));
        Assert.Equal(["Bar do Zé", "Cantina São Jorge", "Pizzaria Bella"], withoutSite.Items.Select(l => l.Name));

        var unaccented = await ListAsync(org, new ListFoundLeadsQuery(null, FoundLeadStatus.New, "sao jorge", null, null, null, FoundLeadSort.Name, 1, 50));
        Assert.Equal("Cantina São Jorge", Assert.Single(unaccented.Items).Name);

        var barId = all.Items.Single(l => l.Name == "Bar do Zé").Id;
        await using (var db = fixture.Database.Open(org.Id))
        {
            var changed = await new TriageFoundLeadsCommandHandler(db, org.Admin, new NullPublisher())
                .Handle(new TriageFoundLeadsCommand([barId], TriageAction.Discard), default);
            Assert.Equal(1, changed);
        }

        var page = await ListAsync(org, new ListFoundLeadsQuery(search, FoundLeadStatus.New, null, null, null, 4.5m, FoundLeadSort.Reviews, 1, 1));
        Assert.Equal("Pizzaria Bella", Assert.Single(page.Items).Name);
        Assert.Equal(2, page.TotalCount);
        Assert.Equal(2, page.TotalPages);
        Assert.Equal(new(2, 0, 0), page.Counts); // filtro de nota tira o descartado (sem nota) e a Cantina

        var discarded = await ListAsync(org, new ListFoundLeadsQuery(search, FoundLeadStatus.Discarded, null, null, null, null, FoundLeadSort.Rating, 1, 50));
        Assert.Equal("Bar do Zé", Assert.Single(discarded.Items).Name);
        Assert.Equal(new(3, 0, 1), discarded.Counts);
    }

    [Fact]
    public async Task Importar_cria_empresa_e_negocio_no_funil_com_ligacao_e_reaproveita_empresa_com_negocio_aberto()
    {
        var org = await fixture.NewOrganizationAsync();
        Guid existingCompanyId;
        Guid openDealId;
        await using (var db = fixture.Database.Open(org.Id))
        {
            var seeded = new Company { OrganizationId = org.Id, Name = "Já no funil", Phone = "48 3222-1111" };
            db.Companies.Add(seeded);
            var deal = Deal.Create(org.Id, seeded.Id, null, DealStage.Qualificacao, DealSource.Sdr, org.AdminId, null, null, org.AdminId, DateTime.UtcNow);
            db.Deals.Add(deal);
            await db.SaveChangesAsync();
            existingCompanyId = seeded.Id;
            openDealId = deal.Id;
        }

        var search = await RequestAsync(org, "imobiliárias", "Florianópolis");
        await IngestAsync(org, search,
        [
            Lead("Imobiliária Ilha", phone: "48 3222-0000", category: "Imobiliária", rating: 4.6m, reviews: 52, address: "Rua A, 10 - Centro"),
            Lead("Casa & Cia", phone: "(48) 3222-1111"),
        ]);

        var ids = await ListIdsAsync(org, search);
        var now = new DateTime(2026, 10, 5, 13, 0, 0, DateTimeKind.Utc); // 10:00 em Brasília
        ImportFoundLeadsResult result;
        await using (var db = fixture.Database.Open(org.Id))
        {
            var handler = new ImportFoundLeadsCommandHandler(db, org.Sdr, new FrozenOrganizationClock(SaoPaulo, now), new NullPublisher());
            result = await handler.Handle(new ImportFoundLeadsCommand(ids, null, ScheduleCall: true), default);

            var again = await handler.Handle(new ImportFoundLeadsCommand(ids, null, ScheduleCall: true), default);
            Assert.Equal(0, again.Imported);
            Assert.Equal(2, again.Skipped);
        }

        Assert.Equal(2, result.Imported);
        Assert.Contains(openDealId, result.DealIds);

        await using var check = fixture.Database.Open(org.Id);
        var newDeal = await check.Deals.Include(d => d.StageChanges).SingleAsync(d => d.Id != openDealId);
        Assert.Equal(DealSource.LeadFinder, newDeal.Source);
        Assert.Equal(DealStage.Prospect, newDeal.Stage);
        Assert.Equal(org.SdrId, newDeal.OwnerUserId);
        Assert.Single(newDeal.StageChanges);

        var company = await check.Companies.SingleAsync(c => c.Id == newDeal.CompanyId);
        Assert.Equal("Imobiliária Ilha", company.Name);
        Assert.Equal("Imobiliária", company.Segment);
        Assert.Equal("48 3222-0000", company.Phone);

        var call = await check.Tasks.SingleAsync();
        Assert.Equal(newDeal.Id, call.DealId);
        Assert.Equal(ActivityType.Call, call.Type);
        Assert.Equal(new DateTime(2026, 10, 5, 21, 0, 0, DateTimeKind.Utc), call.DueDate); // 18:00 local
        Assert.Contains("nota 4,6 (52 avaliações)", call.Note);

        var reused = await check.FoundLeads.SingleAsync(l => l.Name == "Casa & Cia");
        Assert.Equal(FoundLeadStatus.Imported, reused.Status);
        Assert.Equal(existingCompanyId, reused.CompanyId);
        Assert.Equal(openDealId, reused.DealId);

        Assert.Equal(1, await check.IntegrationEvents.CountAsync(e => e.Type == IntegrationEventTypes.DealCreated));
    }

    [Fact]
    public async Task Outra_organizacao_nao_enxerga_nem_alimenta_a_busca()
    {
        var owner = await fixture.NewOrganizationAsync();
        var intruder = await fixture.NewOrganizationAsync();
        var search = await RequestAsync(owner, "escolas de idiomas", "Recife");
        await IngestAsync(owner, search, [Lead("Speak Up", phone: "81 3000-2000")]);

        var seen = await ListAsync(intruder, new ListFoundLeadsQuery(search, FoundLeadStatus.New, null, null, null, null, FoundLeadSort.Rating, 1, 50));
        Assert.Empty(seen.Items);

        await using var db = fixture.Database.Open(intruder.Id);
        var handler = new ReceiveLeadSearchResultsCommandHandler(db, intruder.ServiceToken, new NpgsqlCompanyPhoneLookup(db), new NullPublisher());
        await Assert.ThrowsAsync<Metup.Application.Common.Exceptions.NotFoundException>(() =>
            handler.Handle(new ReceiveLeadSearchResultsCommand(search, [Lead("Invasor", phone: "81 3000-9999")]), default));
    }

    // ─── Atalhos ──────────────────────────────────────────────────────────────

    private static IncomingLead Lead(
        string name,
        string? phone = null,
        string? placeId = null,
        string? website = null,
        decimal? rating = null,
        int? reviews = null,
        string? category = null,
        string? address = null) =>
        new(placeId, name, category, phone, website, null, null, address, null, null, rating, reviews, null);

    private async Task<Guid> RequestAsync(TestOrganization org, string query, string location, bool withoutWebsite = false)
    {
        await using var db = fixture.Database.Open(org.Id);
        var handler = new RequestLeadSearchCommandHandler(db, org.Sdr, new NoDispatch(), new NullPublisher());
        return (await handler.Handle(new RequestLeadSearchCommand(query, location, 50, withoutWebsite), default)).Id;
    }

    private async Task<Guid> StartFromAutomationAsync(TestOrganization org, string externalId, string query)
    {
        await using var db = fixture.Database.Open(org.Id);
        var handler = new StartAutomationLeadSearchCommandHandler(db, org.ServiceToken, new NullPublisher());
        return (await handler.Handle(new StartAutomationLeadSearchCommand(externalId, query, null), default)).Id;
    }

    private async Task<Application.LeadFinder.Common.LeadSearchDto> FinishAsync(TestOrganization org, Guid search, bool success, string? error)
    {
        await using var db = fixture.Database.Open(org.Id);
        return await new FinishLeadSearchCommandHandler(db, org.ServiceToken, new NullPublisher())
            .Handle(new FinishLeadSearchCommand(search, success, error), default);
    }

    private async Task<Application.LeadFinder.Common.LeadBatchResultDto> IngestAsync(TestOrganization org, Guid search, IReadOnlyList<IncomingLead> leads)
    {
        await using var db = fixture.Database.Open(org.Id);
        var handler = new ReceiveLeadSearchResultsCommandHandler(db, org.ServiceToken, new NpgsqlCompanyPhoneLookup(db), new NullPublisher());
        return await handler.Handle(new ReceiveLeadSearchResultsCommand(search, leads), default);
    }

    private async Task<Application.LeadFinder.Common.FoundLeadPageDto> ListAsync(TestOrganization org, ListFoundLeadsQuery query)
    {
        await using var db = fixture.Database.Open(org.Id);
        return await new ListFoundLeadsQueryHandler(db, org.Sdr, new NpgsqlTextSearch()).Handle(query, default);
    }

    private async Task<List<Guid>> ListIdsAsync(TestOrganization org, Guid search) =>
        [.. (await ListAsync(org, new ListFoundLeadsQuery(search, FoundLeadStatus.New, null, null, null, null, FoundLeadSort.Name, 1, 50))).Items.Select(l => l.Id)];

    private sealed class NoDispatch : ILeadSearchDispatcher
    {
        public void Dispatch(Guid organizationId, Guid integrationEventId)
        {
        }
    }

    private sealed class NullPublisher : IPublisher
    {
        public Task Publish(object notification, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task Publish<TNotification>(TNotification notification, CancellationToken cancellationToken = default)
            where TNotification : INotification => Task.CompletedTask;
    }
}

public sealed record TestOrganization(Guid Id, Guid AdminId, Guid SdrId)
{
    public ICurrentUserService Admin => new FakeCurrentUser(Id, AdminId, DefaultPermissions.Administrator);

    public ICurrentUserService Sdr => new FakeCurrentUser(Id, SdrId, DefaultPermissions.Sdr);

    /// <summary>O n8n: só organização, sem usuário nem permissões.</summary>
    public ICurrentUserService ServiceToken => new ServiceTokenCaller(Id);

    private sealed class ServiceTokenCaller(Guid organizationId) : ICurrentUserService
    {
        public Guid? UserId => null;

        public Guid? OrganizationId => organizationId;

        public IReadOnlySet<Permission> Permissions { get; } = new HashSet<Permission>();
    }
}

/// <summary>Um banco descartável para a classe; cada teste pede uma organização nova.</summary>
public sealed class LeadFinderDatabase : IAsyncLifetime
{
    private PostgresTestDatabase? _database;
    private string? _unavailableReason;

    public PostgresTestDatabase Database =>
        _database ?? throw new InvalidOperationException("Postgres indisponível.");

    public async ValueTask InitializeAsync() => (_database, _unavailableReason) = await PostgresTestDatabase.CreateAsync();

    public async Task<TestOrganization> NewOrganizationAsync()
    {
        if (_database is null)
        {
            Assert.Skip(_unavailableReason ?? "Postgres indisponível.");
        }

        var organizationId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var sdrId = Guid.NewGuid();

        await using var db = _database.OpenUnscoped();
        var roles = Role.CreateDefaults(organizationId);
        db.Organizations.Add(new Organization { Id = organizationId, Name = $"Org {organizationId:N}" });
        db.Roles.AddRange(roles);
        db.Users.AddRange(
            new User { Id = adminId, OrganizationId = organizationId, Name = "Ana Admin", Email = $"ana-{organizationId:N}@teste.invalido", PasswordHash = "x", RoleId = roles.Single(r => r.IsAdministrator).Id },
            new User { Id = sdrId, OrganizationId = organizationId, Name = "Sid SDR", Email = $"sid-{organizationId:N}@teste.invalido", PasswordHash = "x", RoleId = roles.Single(r => r.Name == "SDR").Id });
        await db.SaveChangesAsync();

        return new TestOrganization(organizationId, adminId, sdrId);
    }

    public async ValueTask DisposeAsync()
    {
        if (_database is not null)
        {
            await _database.DisposeAsync();
        }
    }
}
