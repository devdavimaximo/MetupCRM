using Metup.Application.Common.Interfaces;
using Metup.Application.Deals.Analytics;
using Metup.Application.Reports.Common;
using Metup.Application.Reports.Queries.GetCohortReport;
using Metup.Application.Reports.Queries.GetForecastReport;
using Metup.Application.Reports.Queries.GetFunnelReport;
using Metup.Application.Reports.Queries.GetSalesPerformanceByOwner;
using Metup.Application.Reports.Queries.GetSalesPerformanceBySegment;
using Metup.Application.Reports.Queries.GetSalesPerformanceBySource;
using Metup.Application.Reports.Queries.GetTimeToCloseReport;
using Metup.Domain.Activities;
using Metup.Domain.Companies;
using Metup.Domain.Deals;
using Metup.Domain.Organizations;
using Metup.Domain.Users;
using Metup.Infrastructure.Persistence;
using Xunit;

namespace Metup.Integration.Tests.Reports;

/// <summary>
/// A massa dourada dos relatórios: poucos negócios, cada um com um papel, e todo número esperado
/// calculável à mão (as contas estão nos testes). Fuso America/Sao_Paulo (UTC−3, sem horário de
/// verão desde 2019); "agora" = 01/10/2026 12:00 local; período pedido = setembro/2026 (30 dias),
/// janela anterior = 02/08 a 31/08.
///
/// <code>
///      criado (local)      dono    segmento  origem     valor          história                       fecha
/// D1   02/09               Ana     Saúde     Sdr        10.000→12.000  Prospect→1ºContato→Reunião→Proposta  ganho 20/09
/// D2   05/09               Bruno   Varejo    MetaAds    ticket 5.000   Prospect→1ºContato           perdido 12/09 (Preço)
/// D3   10/09               Ana     —         Indicacao  8.000          Prospect→Qualificação (pulou)  aberto, previsão 15/10
/// D4   31/08 23:30 *       Bruno   Varejo    Sdr        3.000          Prospect                       aberto, sem previsão
/// D5   10/08               Ana     Saúde     Sdr        4.000          Prospect→Reunião             ganho 20/08
/// D6   01/06               Bruno   Varejo    Indicacao  6.000          Prospect→Negociação          ganho 25/09
/// D7   05/08               Ana     Saúde     Sdr        ticket 2.000   Prospect                     perdido 15/08 (Sem resposta)
/// D8   20/08               Ana     —         Sdr        1.000          Prospect                     aberto, previsão 25/08 (vencida)
/// </code>
/// * D4 é 01/09 02:30 em UTC: em UTC cairia em setembro; no fuso da organização é agosto.
///
/// Ligações: 6 no período (uma em 30/09 23:00 local = 01/10 02:00 UTC), 3 na janela anterior (uma
/// em 31/08 23:59 local = 01/09 02:59 UTC), 1 fora das duas; um WhatsApp no período (não é ligação).
/// Outra organização tem um negócio ganho de R$ 999.999 no período e 5 ligações — nada dela pode
/// aparecer.
/// </summary>
public sealed class ReportScenario : IAsyncLifetime
{
    public static readonly TimeZoneInfo SaoPaulo = ResolveSaoPaulo();

    public static readonly DateTime NowUtc = new(2026, 10, 1, 15, 0, 0, DateTimeKind.Utc);

    public static readonly DateOnly September1 = new(2026, 9, 1);

    public static readonly DateOnly September30 = new(2026, 9, 30);

    public Guid OrganizationId { get; } = Guid.NewGuid();

    public Guid OtherOrganizationId { get; } = Guid.NewGuid();

    public Guid AnaId { get; } = Guid.NewGuid();

    public Guid BrunoId { get; } = Guid.NewGuid();

    public PostgresTestDatabase? Database { get; private set; }

    public string? UnavailableReason { get; private set; }

    public async ValueTask InitializeAsync()
    {
        (Database, UnavailableReason) = await PostgresTestDatabase.CreateAsync();
        if (Database is not null)
        {
            await SeedAsync(Database);
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (Database is not null)
        {
            await Database.DisposeAsync();
        }
    }

    /// <summary>Os relatórios como a requisição os monta: contexto e usuário da organização do cenário.</summary>
    public ReportRunner Runner()
    {
        if (Database is null)
        {
            Assert.Skip(UnavailableReason ?? "Postgres indisponível.");
        }

        return new ReportRunner(
            Database.Open(OrganizationId),
            new FakeCurrentUser(OrganizationId, AnaId, Enum.GetValues<Permission>()),
            new FrozenOrganizationClock(SaoPaulo, NowUtc));
    }

    /// <summary>13:00 UTC (10:00 local) do dia: dias inteiros entre marcos, sem ambiguidade de fuso.</summary>
    public static DateTime At(int month, int day) => new(2026, month, day, 13, 0, 0, DateTimeKind.Utc);

    private async Task SeedAsync(PostgresTestDatabase database)
    {
        await using var db = database.OpenUnscoped();

        var roles = Role.CreateDefaults(OrganizationId);
        var adminRoleId = roles.Single(r => r.IsAdministrator).Id;
        db.Organizations.Add(new Organization { Id = OrganizationId, Name = "Cenário dourado" });
        db.Roles.AddRange(roles);
        db.Users.AddRange(
            new User { Id = AnaId, OrganizationId = OrganizationId, Name = "Ana", Email = "ana@cenario.invalido", PasswordHash = "x", RoleId = adminRoleId },
            new User { Id = BrunoId, OrganizationId = OrganizationId, Name = "Bruno", Email = "bruno@cenario.invalido", PasswordHash = "x", RoleId = adminRoleId });

        var saude = NewCompany(db, OrganizationId, "Clínica Vida", "Saúde");
        var varejo = NewCompany(db, OrganizationId, "Loja Sol", "Varejo");
        var semSegmento = NewCompany(db, OrganizationId, "Sem Rótulo", null);

        var deals = new DealWriter(db, OrganizationId);

        var d1 = deals.Open(saude, DealSource.Sdr, AnaId, ticket: null, amount: 10_000m, At(9, 2));
        deals.Move(d1, DealStage.PrimeiroContato, At(9, 4));
        deals.Move(d1, DealStage.Reuniao, At(9, 10));
        deals.Move(d1, DealStage.Proposta, At(9, 15));
        deals.Win(d1, 12_000m, At(9, 20));

        var d2 = deals.Open(varejo, DealSource.MetaAds, BrunoId, ticket: 5_000m, amount: null, At(9, 5));
        deals.Move(d2, DealStage.PrimeiroContato, At(9, 7));
        deals.Lose(d2, LostReason.Preco, At(9, 12));

        var d3 = deals.Open(semSegmento, DealSource.Indicacao, AnaId, ticket: null, amount: 8_000m, At(9, 10));
        deals.Move(d3, DealStage.Qualificacao, At(9, 12));
        d3.SetExpectedCloseDate(new DateOnly(2026, 10, 15), new DateOnly(2026, 9, 10));

        // 31/08 23:30 em Brasília = 01/09 02:30 UTC.
        deals.Open(varejo, DealSource.Sdr, BrunoId, ticket: null, amount: 3_000m, new DateTime(2026, 9, 1, 2, 30, 0, DateTimeKind.Utc));

        var d5 = deals.Open(saude, DealSource.Sdr, AnaId, ticket: null, amount: 4_000m, At(8, 10));
        deals.Move(d5, DealStage.Reuniao, At(8, 12));
        deals.Win(d5, 4_000m, At(8, 20));

        var d6 = deals.Open(varejo, DealSource.Indicacao, BrunoId, ticket: null, amount: 6_000m, At(6, 1));
        deals.Move(d6, DealStage.Negociacao, At(6, 10));
        deals.Win(d6, 6_000m, At(9, 25));

        var d7 = deals.Open(saude, DealSource.Sdr, AnaId, ticket: 2_000m, amount: null, At(8, 5));
        deals.Lose(d7, LostReason.SemResposta, At(8, 15));

        var d8 = deals.Open(semSegmento, DealSource.Sdr, AnaId, ticket: null, amount: 1_000m, At(8, 20));
        d8.SetExpectedCloseDate(new DateOnly(2026, 8, 25), new DateOnly(2026, 8, 20));

        // Ligações do período (6), da janela anterior (3), fora das duas (1) e um WhatsApp.
        DateTime[] calls =
        [
            At(9, 3), At(9, 3), At(9, 6), At(9, 11), At(9, 11),
            new(2026, 10, 1, 2, 0, 0, DateTimeKind.Utc), // 30/09 23:00 local
            At(8, 15), At(8, 15),
            new(2026, 9, 1, 2, 59, 0, DateTimeKind.Utc), // 31/08 23:59 local
            At(7, 1),
        ];
        foreach (var occurredAt in calls)
        {
            db.Activities.Add(Activity.Log(
                OrganizationId, d1.Id, null, ActivityType.Call, ActivityOutcome.Atendeu, null, AnaId, occurredAt));
        }

        db.Activities.Add(Activity.Log(
            OrganizationId, d1.Id, null, ActivityType.WhatsApp, null, null, AnaId, At(9, 8)));

        SeedOtherOrganization(db);

        await db.SaveChangesAsync();
    }

    /// <summary>O vizinho barulhento: se qualquer número dele vazar, os totais dourados quebram.</summary>
    private void SeedOtherOrganization(MetupDbContext db)
    {
        var roles = Role.CreateDefaults(OtherOrganizationId);
        var intruderId = Guid.NewGuid();
        db.Organizations.Add(new Organization { Id = OtherOrganizationId, Name = "Vizinha" });
        db.Roles.AddRange(roles);
        db.Users.Add(new User
        {
            Id = intruderId,
            OrganizationId = OtherOrganizationId,
            Name = "Intrusa",
            Email = "intrusa@vizinha.invalido",
            PasswordHash = "x",
            RoleId = roles.Single(r => r.IsAdministrator).Id,
        });

        var company = NewCompany(db, OtherOrganizationId, "Vizinha S.A.", "Saúde");
        var deals = new DealWriter(db, OtherOrganizationId);

        var big = deals.Open(company, DealSource.Sdr, intruderId, ticket: null, amount: 999_999m, At(9, 3));
        deals.Win(big, 999_999m, At(9, 18));
        deals.Open(company, DealSource.Sdr, intruderId, ticket: null, amount: 777_777m, At(9, 4));

        for (var i = 0; i < 5; i++)
        {
            db.Activities.Add(Activity.Log(
                OtherOrganizationId, big.Id, null, ActivityType.Call, ActivityOutcome.Atendeu, null, intruderId, At(9, 6)));
        }
    }

    private static Company NewCompany(MetupDbContext db, Guid organizationId, string name, string? segment)
    {
        var company = new Company { OrganizationId = organizationId, Name = name, Segment = segment };
        db.Companies.Add(company);
        return company;
    }

    private static TimeZoneInfo ResolveSaoPaulo() =>
        TimeZoneInfo.TryFindSystemTimeZoneById("America/Sao_Paulo", out var iana)
            ? iana
            : TimeZoneInfo.FindSystemTimeZoneById("E. South America Standard Time");

    /// <summary>
    /// Escreve negócios pelo domínio, com datas escolhidas: nascimento, transições e fechamento gravam
    /// <c>StageChange</c> e histórico de valor como no uso real.
    /// </summary>
    private sealed class DealWriter(MetupDbContext db, Guid organizationId)
    {
        public Deal Open(Company company, DealSource source, Guid ownerId, decimal? ticket, decimal? amount, DateTime createdAtUtc)
        {
            var deal = Deal.Create(
                organizationId, company.Id, null, DealStage.Prospect, source, ownerId, ticket, amount, ownerId, createdAtUtc);
            db.Deals.Add(deal);
            return deal;
        }

        public void Move(Deal deal, DealStage stage, DateTime atUtc) => deal.ChangeStage(stage, deal.OwnerUserId, atUtc);

        public void Win(Deal deal, decimal closedAmount, DateTime atUtc) =>
            Track(deal.Close(true, closedAmount, null, null, deal.OwnerUserId, atUtc));

        public void Lose(Deal deal, LostReason reason, DateTime atUtc) =>
            Track(deal.Close(false, null, reason, null, deal.OwnerUserId, atUtc));

        private void Track(DealClosure closure)
        {
            if (closure.ValueChange is { } valueChange)
            {
                db.DealValueChanges.Add(valueChange);
            }
        }
    }
}

/// <summary>Os sete relatórios montados como na requisição — mesma composição do DI.</summary>
public sealed class ReportRunner(MetupDbContext db, ICurrentUserService currentUser, IOrganizationClock clock) : IAsyncDisposable
{
    private ReportPeriodResolver Resolver => new(db, currentUser, clock);

    public Task<FunnelReportDto> Funnel(DateOnly from, DateOnly to) =>
        new GetFunnelReportQueryHandler(db, Resolver).Handle(new GetFunnelReportQuery(From: from, To: to), Token);

    public Task<SalesPerformanceReportDto> ByOwner(DateOnly from, DateOnly to) =>
        new GetSalesPerformanceByOwnerQueryHandler(db, Resolver, new SalesPerformanceReader(db))
            .Handle(new GetSalesPerformanceByOwnerQuery(From: from, To: to), Token);

    public Task<SalesPerformanceReportDto> BySegment(DateOnly from, DateOnly to) =>
        new GetSalesPerformanceBySegmentQueryHandler(Resolver, new SalesPerformanceReader(db))
            .Handle(new GetSalesPerformanceBySegmentQuery(From: from, To: to), Token);

    public Task<SalesPerformanceReportDto> BySource(DateOnly from, DateOnly to) =>
        new GetSalesPerformanceBySourceQueryHandler(Resolver, new SalesPerformanceReader(db))
            .Handle(new GetSalesPerformanceBySourceQuery(From: from, To: to), Token);

    public Task<TimeToCloseReportDto> TimeToClose(DateOnly from, DateOnly to) =>
        new GetTimeToCloseReportQueryHandler(Resolver, new TimeToCloseReader(db))
            .Handle(new GetTimeToCloseReportQuery(From: from, To: to), Token);

    public Task<CohortReportDto> Cohorts(DateOnly from, DateOnly to) =>
        new GetCohortReportQueryHandler(Resolver).Handle(new GetCohortReportQuery(From: from, To: to), Token);

    public Task<ForecastReportDto> Forecast(DateOnly from, DateOnly to) =>
        new GetForecastReportQueryHandler(db, Resolver, new StageAnalyticsProvider(db))
            .Handle(new GetForecastReportQuery(From: from, To: to), Token);

    public ValueTask DisposeAsync() => db.DisposeAsync();

    private static CancellationToken Token => TestContext.Current.CancellationToken;
}
