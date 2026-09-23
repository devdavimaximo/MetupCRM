using Metup.Application.Activities.Common;
using FluentValidation;
using Metup.Application.Dashboard.Common;
using Metup.Application.Deals.Analytics;
using Metup.Application.Dashboard.Queries.GetDashboardOverview;
using Metup.Domain.Users;
using Xunit;

namespace Metup.Application.Tests.Dashboard;

public class CustomPeriodTests
{
    /// <summary>15/09/2026, 14h em São Paulo.</summary>
    private static readonly DateTime NowUtc = new(2026, 9, 15, 17, 0, 0, DateTimeKind.Utc);

    private static FakeOrganizationClock Clock() => new(DashboardOverviewTestContext.SaoPaulo, NowUtc);

    private static Task<DashboardOverviewDto> RunAsync(DashboardOverviewTestContext context, DateOnly from, DateOnly to)
    {
        var handler = new GetDashboardOverviewQueryHandler(context.Db, context.As(context.AdminUserId, DefaultRole.Admin), Clock(), new ActivityFeedReader(context.Db, Clock()), new StageAnalyticsProvider(context.Db));
        return handler.Handle(new GetDashboardOverviewQuery(From: from, To: to), CancellationToken.None);
    }

    private static Task<FluentValidation.Results.ValidationResult> ValidateAsync(GetDashboardOverviewQuery query) =>
        new GetDashboardOverviewQueryValidator(Clock()).ValidateAsync(query);

    [Fact]
    public async Task Periodo_personalizado_recorta_dias_locais_inteiros_e_tem_precedencia_sobre_Days()
    {
        using var context = new DashboardOverviewTestContext();

        // Mês anterior (agosto): 31/08 às 23h em SP (= 01/09 02h UTC) ainda é agosto; 01/09 às 01h local não é.
        context.AddWonDeal(context.AdminUserId, 3_000m, NowUtc.AddDays(-60), new DateTime(2026, 9, 1, 2, 0, 0, DateTimeKind.Utc));
        context.AddWonDeal(context.AdminUserId, 9_000m, NowUtc.AddDays(-60), new DateTime(2026, 9, 1, 4, 0, 0, DateTimeKind.Utc));

        var handler = new GetDashboardOverviewQueryHandler(context.Db, context.As(context.AdminUserId, DefaultRole.Admin), Clock(), new ActivityFeedReader(context.Db, Clock()), new StageAnalyticsProvider(context.Db));
        var overview = await handler.Handle(
            new GetDashboardOverviewQuery(Days: 7, From: new DateOnly(2026, 8, 1), To: new DateOnly(2026, 8, 31)),
            CancellationToken.None);

        Assert.Equal(31, overview.PeriodDays);
        Assert.Equal(new DateOnly(2026, 8, 1), overview.PeriodStartLocal);
        Assert.Equal(new DateOnly(2026, 8, 31), overview.PeriodEndLocal);
        Assert.Equal(new DateTime(2026, 8, 1, 3, 0, 0, DateTimeKind.Utc), overview.PeriodStart);
        Assert.Equal(3_000m, overview.Revenue.Current);
        Assert.Equal(31, overview.RevenueSeries.Count);
        Assert.Equal("day", overview.SeriesGranularity);
    }

    [Fact]
    public async Task Janela_anterior_do_periodo_personalizado_tem_a_mesma_quantidade_de_dias_imediatamente_antes()
    {
        using var context = new DashboardOverviewTestContext();

        // 10/08 cai na janela anterior de 11/08–20/08 (01/08–10/08); 31/07 fica fora das duas.
        context.AddWonDeal(context.AdminUserId, 2_000m, NowUtc.AddDays(-90), new DateTime(2026, 8, 10, 15, 0, 0, DateTimeKind.Utc));
        context.AddWonDeal(context.AdminUserId, 5_000m, NowUtc.AddDays(-90), new DateTime(2026, 7, 31, 15, 0, 0, DateTimeKind.Utc));

        var overview = await RunAsync(context, new DateOnly(2026, 8, 11), new DateOnly(2026, 8, 20));

        Assert.Equal(new DateTime(2026, 8, 1, 3, 0, 0, DateTimeKind.Utc), overview.PreviousStart);
        Assert.Equal(2_000m, overview.Revenue.Previous);
        Assert.Equal(0m, overview.Revenue.Current);
    }

    [Fact]
    public async Task Periodo_acima_de_31_dias_agrupa_a_serie_por_semana()
    {
        using var context = new DashboardOverviewTestContext();

        var overview = await RunAsync(context, new DateOnly(2026, 6, 1), new DateOnly(2026, 8, 31));

        Assert.Equal("week", overview.SeriesGranularity);
        Assert.Equal(new DateOnly(2026, 6, 1), overview.RevenueSeries[0].BucketStart);
    }

    [Theory]
    [InlineData("2026-09-01", "2026-09-15", true)]   // termina hoje
    [InlineData("2025-09-15", "2026-09-15", true)]   // 366 dias
    [InlineData("2025-09-14", "2026-09-15", false)]  // 367 dias
    [InlineData("2026-09-10", "2026-09-09", false)]  // início depois do fim
    [InlineData("2026-09-10", "2026-09-16", false)]  // amanhã no fuso da organização
    public async Task Validador_aplica_os_limites_do_periodo(string from, string to, bool valid)
    {
        var result = await ValidateAsync(new GetDashboardOverviewQuery(From: DateOnly.Parse(from), To: DateOnly.Parse(to)));

        Assert.Equal(valid, result.IsValid);
    }

    [Fact]
    public async Task Validador_exige_as_duas_datas_ou_nenhuma()
    {
        Assert.False((await ValidateAsync(new GetDashboardOverviewQuery(From: new DateOnly(2026, 9, 1)))).IsValid);
        Assert.False((await ValidateAsync(new GetDashboardOverviewQuery(To: new DateOnly(2026, 9, 1)))).IsValid);
        Assert.True((await ValidateAsync(new GetDashboardOverviewQuery(Days: 30))).IsValid);
    }

    [Fact]
    public async Task Hoje_no_fuso_da_organizacao_ainda_e_valido_quando_em_UTC_ja_e_amanha()
    {
        // 15/09 às 23h30 em SP = 16/09 02h30 UTC: "hoje" é 15/09, então 16/09 é futuro.
        var lateNight = new FakeOrganizationClock(DashboardOverviewTestContext.SaoPaulo, new DateTime(2026, 9, 16, 2, 30, 0, DateTimeKind.Utc));
        var validator = new GetDashboardOverviewQueryValidator(lateNight);

        Assert.True((await validator.ValidateAsync(new GetDashboardOverviewQuery(From: new DateOnly(2026, 9, 15), To: new DateOnly(2026, 9, 15)))).IsValid);
        Assert.False((await validator.ValidateAsync(new GetDashboardOverviewQuery(From: new DateOnly(2026, 9, 15), To: new DateOnly(2026, 9, 16)))).IsValid);
    }
}
