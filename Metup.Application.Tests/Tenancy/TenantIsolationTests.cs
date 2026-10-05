using System.Collections;
using FluentValidation;
using Metup.Application.Auth.Commands.Login;
using Metup.Application.Common.Interfaces;
using Metup.Application.Users.Common;
using Metup.Domain.Activities;
using Metup.Domain.Common;
using Metup.Domain.Companies;
using Metup.Domain.Contacts;
using Metup.Domain.Conversations;
using Metup.Domain.Deals;
using Metup.Domain.Integrations;
using Metup.Domain.LeadFinder;
using Metup.Domain.Organizations;
using Metup.Domain.Tasks;
using Metup.Domain.Users;
using Metup.Infrastructure.Persistence;
using Metup.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Metup.Application.Tests.Tenancy;

/// <summary>
/// O isolamento entre organizações é do contexto do EF (regra 4.1 do CLAUDE.md), não de cada handler.
/// Estes testes travam a garantia em três níveis: o modelo (toda entidade de negócio tem o filtro), o
/// dado (duas organizações, uma linha de cada entidade, nenhuma enxerga a outra) e o código (só os
/// pontos autorizados atravessam o filtro).
/// </summary>
public class TenantIsolationTests
{
    private static readonly DateTime NowUtc = new(2026, 10, 1, 15, 0, 0, DateTimeKind.Utc);

    private static readonly System.Reflection.MethodInfo SetMethod =
        typeof(DbContext).GetMethod(nameof(DbContext.Set), Type.EmptyTypes)!;

    [Fact]
    public void Toda_entidade_de_negocio_tem_o_filtro_de_organizacao()
    {
        using var db = new MetupDbContext(InMemoryOptions(), FixedTenantContext.None);

        var unfiltered = TenantScopedTypes(db)
            .Where(t => db.Model.FindEntityType(t)!.FindDeclaredQueryFilter(TenantQueryExtensions.TenantFilterName) is null)
            .Select(t => t.Name)
            .ToList();

        Assert.NotEmpty(TenantScopedTypes(db));
        Assert.Empty(unfiltered);
    }

    [Fact]
    public void Cada_organizacao_enxerga_so_as_proprias_linhas_em_todas_as_entidades()
    {
        var options = InMemoryOptions();
        var organizationA = Guid.NewGuid();
        var organizationB = Guid.NewGuid();
        SeedOrganization(options, organizationA, "a@acme.com");
        SeedOrganization(options, organizationB, "b@beta.com");

        using var dbA = new MetupDbContext(options, new FixedTenantContext(organizationA));
        using var dbB = new MetupDbContext(options, new FixedTenantContext(organizationB));

        foreach (var type in TenantScopedTypes(dbA))
        {
            var rowsA = Rows(dbA, type);
            var rowsB = Rows(dbB, type);

            // Não vazio: a semeadura cobre a entidade (entidade nova sem semeadura derruba o teste).
            Assert.True(rowsA.Count > 0, $"{type.Name}: a semeadura não criou linha para a organização A.");
            Assert.True(rowsB.Count > 0, $"{type.Name}: a semeadura não criou linha para a organização B.");
            Assert.All(rowsA, row => Assert.Equal(organizationA, row.OrganizationId));
            Assert.All(rowsB, row => Assert.Equal(organizationB, row.OrganizationId));
        }
    }

    [Fact]
    public void Sem_organizacao_resolvida_nenhuma_linha_volta()
    {
        var options = InMemoryOptions();
        SeedOrganization(options, Guid.NewGuid(), "a@acme.com");

        using var db = new MetupDbContext(options, FixedTenantContext.None);

        foreach (var type in TenantScopedTypes(db))
        {
            Assert.True(Rows(db, type).Count == 0, $"{type.Name}: vazou sem organização resolvida.");
        }
    }

    [Fact]
    public void No_Postgres_o_filtro_e_um_parametro_lido_por_consulta_nao_um_valor_do_modelo()
    {
        // Só gera o SQL: nenhuma conexão é aberta. O modelo é compartilhado entre contextos — se a
        // organização ficasse congelada nele, o segundo contexto consultaria com a do primeiro.
        var options = new DbContextOptionsBuilder<MetupDbContext>().UseNpgsql("Host=localhost;Database=never").Options;
        var organizationA = Guid.NewGuid();
        var organizationB = Guid.NewGuid();

        using var dbA = new MetupDbContext(options, new FixedTenantContext(organizationA));
        using var dbB = new MetupDbContext(options, new FixedTenantContext(organizationB));

        var sqlA = dbA.Deals.ToQueryString();
        var sqlB = dbB.Deals.ToQueryString();

        Assert.Contains(organizationA.ToString(), sqlA);
        Assert.Contains(organizationB.ToString(), sqlB);
        var body = sqlA[sqlA.IndexOf("SELECT", StringComparison.Ordinal)..];
        Assert.Matches(@"WHERE d\.organization_id = @\w+", body);
        Assert.DoesNotContain(organizationA.ToString(), body);
    }

    [Fact]
    public async Task Login_acha_o_usuario_de_qualquer_organizacao_e_o_cargo_da_organizacao_dele()
    {
        var options = InMemoryOptions();
        SeedOrganization(options, Guid.NewGuid(), "a@acme.com");
        var organizationB = Guid.NewGuid();
        SeedOrganization(options, organizationB, "b@beta.com");

        // Login roda antes de existir organização resolvida — o contexto da requisição está fechado.
        await using var db = new MetupDbContext(options, FixedTenantContext.None);
        var handler = new LoginCommandHandler(db, new PasswordHasher(), new FakeTokenService());

        var result = await handler.Handle(new LoginCommand("B@Beta.com", Password), TestContext.Current.CancellationToken);

        Assert.Equal(organizationB, result.User.OrganizationId);
        var expectedRoleId = await db.Roles.AcrossOrganizations()
            .Where(r => r.OrganizationId == organizationB && r.IsAdministrator)
            .Select(r => r.Id)
            .SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal(expectedRoleId, result.User.RoleId);
    }

    [Fact]
    public async Task Email_em_uso_em_outra_organizacao_continua_indisponivel()
    {
        var options = InMemoryOptions();
        var organizationA = Guid.NewGuid();
        SeedOrganization(options, organizationA, "a@acme.com");
        SeedOrganization(options, Guid.NewGuid(), "b@beta.com");

        await using var dbA = new MetupDbContext(options, new FixedTenantContext(organizationA));

        await Assert.ThrowsAsync<ValidationException>(() =>
            dbA.EnsureEmailAvailableAsync("b@beta.com", exceptUserId: null, "Email", TestContext.Current.CancellationToken));
    }

    /// <summary>
    /// Atravessar o filtro é exceção: <c>IgnoreQueryFilters</c> só no ponto único e
    /// <c>AcrossOrganizations</c> só nos chamadores autorizados. Um chamador novo precisa entrar nesta
    /// lista — de propósito, a decisão fica visível na revisão.
    /// </summary>
    [Fact]
    public void Atravessar_o_filtro_so_acontece_nos_pontos_autorizados()
    {
        string[] allowedCrossTenantCallers =
        [
            "Metup.Application/Auth/Commands/Login/LoginCommandHandler.cs",
            "Metup.Application/Users/Common/UserAccessRules.cs",
        ];
        const string singleBypassPoint = "Metup.Application/Common/Interfaces/TenantQueryExtensions.cs";

        var sources = ProductionSources();

        Assert.Equal([singleBypassPoint], FilesContaining(sources, "IgnoreQueryFilters"));
        Assert.Equal(
            allowedCrossTenantCallers.Order(StringComparer.Ordinal),
            FilesContaining(sources, ".AcrossOrganizations()"));
    }

    private const string Password = "senha-forte-123";

    private static DbContextOptions<MetupDbContext> InMemoryOptions() =>
        new DbContextOptionsBuilder<MetupDbContext>().UseInMemoryDatabase($"tenancy-{Guid.NewGuid()}").Options;

    private static List<Type> TenantScopedTypes(MetupDbContext db) =>
        db.Model.GetEntityTypes()
            .Where(t => t.BaseType is null && !t.IsOwned() && typeof(BaseEntity).IsAssignableFrom(t.ClrType))
            .Select(t => t.ClrType)
            .ToList();

    private static List<BaseEntity> Rows(MetupDbContext db, Type clrType) =>
        ((IEnumerable)SetMethod.MakeGenericMethod(clrType).Invoke(db, null)!).Cast<BaseEntity>().ToList();

    /// <summary>Uma linha de cada entidade de negócio, pelas fábricas do domínio quando existem.</summary>
    private static void SeedOrganization(DbContextOptions<MetupDbContext> options, Guid organizationId, string adminEmail)
    {
        // Gravar não passa pelo filtro: um contexto sem tenant semeia qualquer organização.
        using var db = new MetupDbContext(options, FixedTenantContext.None);

        var roles = Role.CreateDefaults(organizationId);
        var admin = new User
        {
            OrganizationId = organizationId,
            Name = "Admin",
            Email = adminEmail,
            PasswordHash = new PasswordHasher().Hash(Password),
            RoleId = roles.Single(r => r.IsAdministrator).Id,
        };

        var company = new Company { OrganizationId = organizationId, Name = "Empresa" };
        var contact = new Contact { OrganizationId = organizationId, CompanyId = company.Id, Name = "Contato" };

        var deal = Deal.Create(
            organizationId, company.Id, contact.Id, DealStage.Prospect, DealSource.Sdr, admin.Id, null, null, admin.Id, NowUtc);
        var valueChange = deal.ChangeValue(1000m, null, admin.Id, NowUtc)!;

        var task = TaskItem.Create(organizationId, deal.Id, ActivityType.Call, NowUtc.AddDays(1), admin.Id, null);
        var reschedule = task.Reschedule(NowUtc.AddDays(2), admin.Id, NowUtc);

        var conversation = Conversation.Create(organizationId, contact.Id, ConversationChannel.WhatsApp);
        var message = Message.SendOutbound(organizationId, conversation.Id, "Olá", admin.Id, deal.Id, deal.Stage, NowUtc);
        var tagOption = ConversationTagOption.Create(organizationId, "Quente");

        db.Organizations.Add(new Organization { Id = organizationId, Name = $"Org {organizationId:N}" });
        db.Roles.AddRange(roles);
        db.Users.Add(admin);
        db.Companies.Add(company);
        db.Contacts.Add(contact);
        db.Deals.Add(deal);
        db.DealValueChanges.Add(valueChange);
        db.Activities.Add(Activity.Log(
            organizationId, deal.Id, contact.Id, ActivityType.Call, ActivityOutcome.Atendeu, null, admin.Id, NowUtc));
        db.Tasks.Add(task);
        db.TaskReschedules.Add(reschedule);
        var leadSearch = LeadSearch.Request(organizationId, "clínicas", "Curitiba", 50, admin.Id, NowUtc);
        db.LeadSearches.Add(leadSearch);
        db.FoundLeads.Add(new FoundLead
        {
            OrganizationId = organizationId,
            LeadSearchId = leadSearch.Id,
            DedupeKey = "tel:4133334444",
            Name = "Clínica",
            FoundAt = NowUtc,
        });
        db.Conversations.Add(conversation);
        db.Messages.Add(message);
        db.MessageAttachments.Add(new MessageAttachment
        {
            OrganizationId = organizationId,
            MessageId = message.Id,
            Kind = default,
            Url = "https://exemplo.invalido/arquivo.pdf",
        });
        db.ConversationReads.Add(new ConversationRead
        {
            OrganizationId = organizationId,
            ConversationId = conversation.Id,
            UserId = admin.Id,
            LastReadAt = NowUtc,
        });
        db.ConversationFavorites.Add(new ConversationFavorite
        {
            OrganizationId = organizationId,
            ConversationId = conversation.Id,
            UserId = admin.Id,
        });
        db.ConversationTagOptions.Add(tagOption);
        db.ConversationTags.Add(new ConversationTag
        {
            OrganizationId = organizationId,
            ConversationId = conversation.Id,
            TagOptionId = tagOption.Id,
        });
        db.IntegrationEvents.Add(IntegrationEvent.Create(organizationId, IntegrationEventTypes.DealCreated, "{}"));

        db.SaveChanges();
    }

    private static Dictionary<string, string> ProductionSources()
    {
        var root = RepositoryRoot();
        string[] projects = ["Metup.Application", "Metup.Infrastructure", "Metup.Server"];

        return projects
            .SelectMany(project => Directory.EnumerateFiles(Path.Combine(root, project), "*.cs", SearchOption.AllDirectories))
            .Where(path => !path.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}")
                && !path.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}")
                && !path.Contains($"{Path.DirectorySeparatorChar}Migrations{Path.DirectorySeparatorChar}"))
            .ToDictionary(
                path => Path.GetRelativePath(root, path).Replace(Path.DirectorySeparatorChar, '/'),
                File.ReadAllText);
    }

    private static List<string> FilesContaining(Dictionary<string, string> sources, string text) =>
        sources.Where(source => source.Value.Contains(text, StringComparison.Ordinal))
            .Select(source => source.Key)
            .Order(StringComparer.Ordinal)
            .ToList();

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "Metup.slnx")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException("Raiz do repositório (Metup.slnx) não encontrada.");
    }

    private sealed class FakeTokenService : ITokenService
    {
        public (string Token, DateTime ExpiresAtUtc) GenerateToken(User user) => ("token", NowUtc.AddHours(1));
    }
}
