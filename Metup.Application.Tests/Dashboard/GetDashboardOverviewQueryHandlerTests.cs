using Metup.Application.Activities.Common;
using Metup.Application.Common.Models;
using Metup.Application.Dashboard.Common;
using Metup.Application.Deals.Analytics;
using Metup.Application.Dashboard.Queries.GetDashboardOverview;
using Metup.Domain.Deals;
using Metup.Domain.Users;
using Xunit;

namespace Metup.Application.Tests.Dashboard;

public class GetDashboardOverviewQueryHandlerTests
{
    /// <summary>15/09/2026, 14h em São Paulo — um "agora" no meio do dia, longe de qualquer virada.</summary>
    private static readonly DateTime NowUtc = new(2026, 9, 15, 17, 0, 0, DateTimeKind.Utc);

    private static Task<DashboardOverviewDto> RunAsync(
        DashboardOverviewTestContext context,
        Guid userId,
        UserRole role,
        int days = 30,
        DealScope scope = DealScope.Organization,
        DateTime? nowUtc = null)
    {
        var handler = new GetDashboardOverviewQueryHandler(
            context.Db,
            context.As(userId, role),
            new FakeOrganizationClock(DashboardOverviewTestContext.SaoPaulo, nowUtc ?? NowUtc),
            new ActivityFeedReader(context.Db),
            // Sem cache: o teste prova o cálculo, não a política de validade.
            new StageAnalyticsProvider(context.Db));

        return handler.Handle(new GetDashboardOverviewQuery(days, scope), CancellationToken.None);
    }

    [Fact]
    public async Task Negocio_so_com_ticket_entra_no_pipeline_como_valor_estimado()
    {
        using var context = new DashboardOverviewTestContext();
        context.AddOpenDeal(context.AdminUserId, amount: null, ticket: 8_000m, createdAtUtc: NowUtc.AddDays(-3));

        var overview = await RunAsync(context, context.AdminUserId, UserRole.Admin);

        var stage = Assert.Single(overview.Pipeline);
        Assert.Equal(8_000m, stage.Amount);
        Assert.Equal(1, stage.EstimatedCount);
        Assert.Equal(0, overview.OpenDealsWithoutAmount);

        var featured = Assert.Single(overview.FeaturedDeals);
        Assert.Equal(8_000m, featured.Amount);
        Assert.True(featured.IsEstimated);
    }

    [Fact]
    public async Task Negocio_sem_valor_e_sem_ticket_conta_como_sem_valor()
    {
        using var context = new DashboardOverviewTestContext();
        context.AddOpenDeal(context.AdminUserId, amount: null, ticket: null, createdAtUtc: NowUtc.AddDays(-3));

        var overview = await RunAsync(context, context.AdminUserId, UserRole.Admin);

        Assert.Equal(1, overview.OpenDealsWithoutAmount);
        Assert.Empty(overview.FeaturedDeals);
    }

    [Fact]
    public async Task Receita_ganha_ignora_o_ticket()
    {
        using var context = new DashboardOverviewTestContext();
        context.AddWonDeal(context.AdminUserId, amount: 5_000m, createdAtUtc: NowUtc.AddDays(-10), closedAtUtc: NowUtc.AddDays(-2));
        context.AddOpenDeal(context.AdminUserId, amount: null, ticket: 99_000m, createdAtUtc: NowUtc.AddDays(-3));

        var overview = await RunAsync(context, context.AdminUserId, UserRole.Admin);

        Assert.Equal(5_000m, overview.Revenue.Current);
    }

    [Fact]
    public async Task Sdr_pedindo_a_organizacao_recebe_apenas_a_propria_carteira()
    {
        using var context = new DashboardOverviewTestContext();
        context.AddOpenDeal(context.AdminUserId, amount: 50_000m, ticket: null, createdAtUtc: NowUtc.AddDays(-5));
        context.AddOpenDeal(context.SdrUserId, amount: 7_000m, ticket: null, createdAtUtc: NowUtc.AddDays(-5));

        var overview = await RunAsync(context, context.SdrUserId, UserRole.Sdr, scope: DealScope.Organization);

        Assert.Equal(DealScope.Mine, overview.Scope);
        Assert.Equal(7_000m, overview.Pipeline.Sum(p => p.Amount));
        Assert.Equal(context.SdrUserId, Assert.Single(overview.Owners).OwnerUserId);
    }

    [Fact]
    public async Task Admin_enxerga_a_organizacao_inteira()
    {
        using var context = new DashboardOverviewTestContext();
        context.AddOpenDeal(context.AdminUserId, amount: 50_000m, ticket: null, createdAtUtc: NowUtc.AddDays(-5));
        context.AddOpenDeal(context.SdrUserId, amount: 7_000m, ticket: null, createdAtUtc: NowUtc.AddDays(-5));

        var overview = await RunAsync(context, context.AdminUserId, UserRole.Admin);

        Assert.Equal(DealScope.Organization, overview.Scope);
        Assert.Equal(57_000m, overview.Pipeline.Sum(p => p.Amount));
        Assert.Equal(2, overview.Owners.Count);
    }

    [Fact]
    public async Task Venda_as_23h_de_Brasilia_cai_no_dia_local_e_nao_no_seguinte()
    {
        using var context = new DashboardOverviewTestContext();

        // 15/09 às 23h em São Paulo = 16/09 às 02h UTC: em UTC puro, a venda "pularia" para o dia 16.
        var closedAtUtc = new DateTime(2026, 9, 16, 2, 0, 0, DateTimeKind.Utc);
        context.AddWonDeal(context.AdminUserId, amount: 4_000m, createdAtUtc: NowUtc.AddDays(-9), closedAtUtc: closedAtUtc);

        var overview = await RunAsync(context, context.AdminUserId, UserRole.Admin, days: 7, nowUtc: closedAtUtc.AddMinutes(30));

        Assert.Equal(4_000m, overview.Revenue.Current);
        var point = Assert.Single(overview.RevenueSeries, p => p.Revenue > 0);
        Assert.Equal(new DateOnly(2026, 9, 15), point.BucketStart);
    }

    [Fact]
    public async Task Janela_anterior_tem_a_mesma_duracao_e_termina_onde_a_atual_comeca()
    {
        using var context = new DashboardOverviewTestContext();
        context.AddOpenDeal(context.AdminUserId, amount: 1_000m, ticket: null, createdAtUtc: NowUtc.AddDays(-1));

        var overview = await RunAsync(context, context.AdminUserId, UserRole.Admin, days: 30);

        Assert.Equal(30, (overview.PeriodStart - overview.PreviousStart).Days);
        // Início do dia local de 17/08/2026 (30 dias contando hoje) = 03h UTC.
        Assert.Equal(new DateTime(2026, 8, 17, 3, 0, 0, DateTimeKind.Utc), overview.PeriodStart);
        Assert.Equal(30, overview.RevenueSeries.Count);
    }

    [Fact]
    public async Task Sem_historico_de_fechamento_nao_ha_receita_prevista()
    {
        using var context = new DashboardOverviewTestContext();
        context.AddOpenDeal(context.AdminUserId, amount: null, ticket: 10_000m, createdAtUtc: NowUtc.AddDays(-2));

        var overview = await RunAsync(context, context.AdminUserId, UserRole.Admin);

        Assert.Null(overview.WeightedForecast);
    }

    [Fact]
    public async Task Receita_prevista_pondera_o_valor_efetivo_pela_probabilidade_historica()
    {
        using var context = new DashboardOverviewTestContext();

        // Dois negócios já fechados que passaram por Prospect: um ganho, um perdido → 50%.
        context.AddWonDeal(context.AdminUserId, amount: 1_000m, createdAtUtc: NowUtc.AddDays(-20), closedAtUtc: NowUtc.AddDays(-15));
        context.AddClosedDeal(context.AdminUserId, won: false, amount: 1_000m, createdAtUtc: NowUtc.AddDays(-20), closedAtUtc: NowUtc.AddDays(-14));

        context.AddOpenDeal(context.AdminUserId, amount: null, ticket: 10_000m, createdAtUtc: NowUtc.AddDays(-2), stage: DealStage.Prospect);

        var overview = await RunAsync(context, context.AdminUserId, UserRole.Admin);

        Assert.Equal(5_000m, overview.WeightedForecast);
    }

    [Fact]
    public async Task Taxa_de_avanco_da_etapa_vem_do_historico_de_StageChange()
    {
        using var context = new DashboardOverviewTestContext();

        // Um negócio saiu de Prospect para Qualificação; o outro ficou parado em Prospect.
        context.AddOpenDeal(context.AdminUserId, amount: 1_000m, ticket: null, createdAtUtc: NowUtc.AddDays(-9), stage: DealStage.Qualificacao);
        context.AddOpenDeal(context.AdminUserId, amount: 1_000m, ticket: null, createdAtUtc: NowUtc.AddDays(-9));

        var overview = await RunAsync(context, context.AdminUserId, UserRole.Admin);

        var prospect = Assert.Single(overview.StageAdvanceRates, s => s.Stage == DealStage.Prospect);
        Assert.Equal(2, prospect.EnteredCount);
        Assert.Equal(1, prospect.AdvancedCount);
        Assert.Equal(0.5m, prospect.AdvanceRate);
    }
}
