using Metup.Application.Common.Models;
using Metup.Application.Dashboard.Queries.GetDashboardOverview;
using Metup.Application.Deals.Common;
using Metup.Application.Deals.Queries.GetPipelineSummary;
using Metup.Domain.Deals;
using Metup.Domain.Users;
using Xunit;

namespace Metup.Application.Tests.Deals;

public class PipelineSummaryTests
{
    private static readonly DateTime Now = PipelineTestContext.NowUtc;
    private static readonly DealPipelineFilter AllOwners = new(AllOwners: true);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Pipeline_previsao_abertos_e_ticket_medio_sao_os_mesmos_numeros_do_dashboard()
    {
        using var context = new PipelineTestContext();
        // Histórico de fechamento para haver probabilidade de ganho por etapa.
        var won1 = context.AddDeal(context.AdminUserId, Now.AddDays(-80), amount: 10_000m, path: [DealStage.Qualificacao, DealStage.Proposta]);
        context.Close(won1, won: true, Now.AddDays(-10), closedAmount: 12_000m);
        var won2 = context.AddDeal(context.SdrUserId, Now.AddDays(-70), ticket: 4_000m, path: [DealStage.Proposta]);
        context.Close(won2, won: true, Now.AddDays(-2), closedAmount: 5_000m);
        var lost = context.AddDeal(context.SdrUserId, Now.AddDays(-60), amount: 3_000m, path: [DealStage.Qualificacao]);
        context.Close(lost, won: false, Now.AddDays(-5));
        context.AddDeal(context.AdminUserId, Now.AddDays(-40), amount: 2_000m);
        context.AddDeal(context.SdrUserId, Now.AddDays(-30), ticket: 7_500m, path: [DealStage.Qualificacao]);
        context.AddDeal(context.CloserUserId, Now.AddDays(-20), amount: 9_000m, ticket: 1_000m, path: [DealStage.Proposta]);
        context.AddDeal(context.AdminUserId, Now.AddDays(-3), path: [DealStage.Reuniao]);

        var dashboard = await context.Dashboard(context.AdminUserId, UserRole.Admin)
            .Handle(new GetDashboardOverviewQuery(30, DealScope.Organization), Ct);
        var summary = await context.Summary(context.AdminUserId, UserRole.Admin).Handle(new GetPipelineSummaryQuery(AllOwners), Ct);

        Assert.Equal(dashboard.Pipeline.Sum(p => p.Amount), summary.Kpis.PipelineTotal);
        Assert.Equal(dashboard.Pipeline.Sum(p => p.Count), summary.Kpis.OpenDeals);
        Assert.NotNull(dashboard.WeightedForecast);
        Assert.Equal(dashboard.WeightedForecast, summary.Kpis.ForecastRevenue);
        Assert.Equal(dashboard.Revenue.Current / dashboard.WonDeals.Current, summary.Kpis.AverageTicket);
        Assert.Equal((dashboard.PeriodStartLocal, dashboard.PeriodEndLocal), (summary.PeriodStartLocal, summary.PeriodEndLocal));
    }

    [Fact]
    public async Task Conversao_e_a_coorte_do_periodo_e_o_ticket_medio_os_ganhos_do_periodo()
    {
        using var context = new PipelineTestContext();
        var cohortWon = context.AddDeal(context.AdminUserId, Now.AddDays(-20), amount: 1_000m);
        context.Close(cohortWon, won: true, Now.AddDays(-5));
        context.AddDeal(context.AdminUserId, Now.AddDays(-15), amount: 2_000m);
        context.AddDeal(context.AdminUserId, Now.AddDays(-10), ticket: 500m);
        var cohortLost = context.AddDeal(context.AdminUserId, Now.AddDays(-8), amount: 800m);
        context.Close(cohortLost, won: false, Now.AddDays(-2));
        // Criado antes do período: entra no ticket médio (ganho no período), não na coorte.
        var oldWon = context.AddDeal(context.AdminUserId, Now.AddDays(-90), amount: 3_000m);
        context.Close(oldWon, won: true, Now.AddDays(-1));

        var summary = await context.Summary(context.AdminUserId, UserRole.Admin).Handle(new GetPipelineSummaryQuery(AllOwners), Ct);

        Assert.Equal(0.25m, summary.Kpis.ConversionRate);
        Assert.Equal(new PipelineFunnelSummaryDto(4, 1, 0.25m), summary.FunnelSummary);
        Assert.Equal(2_000m, summary.Kpis.AverageTicket);
        Assert.Equal(2, summary.Kpis.OpenDeals);
        Assert.Equal(2_500m, summary.Kpis.PipelineTotal);
    }

    [Fact]
    public async Task Funil_conta_quem_passou_pela_etapa_ou_alem_inclusive_etapas_puladas()
    {
        using var context = new PipelineTestContext();
        var won = context.AddDeal(context.AdminUserId, Now.AddDays(-20), amount: 1_000m, path: [DealStage.PrimeiroContato, DealStage.Reuniao]);
        context.Close(won, won: true, Now.AddDays(-5), closedAmount: 1_500m);
        context.AddDeal(context.AdminUserId, Now.AddDays(-15), ticket: 2_000m, path: [DealStage.Reuniao]);
        context.AddDeal(context.AdminUserId, Now.AddDays(-12), amount: 300m);
        var lost = context.AddDeal(context.AdminUserId, Now.AddDays(-10), amount: 700m, path: [DealStage.Qualificacao]);
        context.Close(lost, won: false, Now.AddDays(-3));

        var summary = await context.Summary(context.AdminUserId, UserRole.Admin).Handle(new GetPipelineSummaryQuery(AllOwners), Ct);

        // Valor no fim da janela: ganho = valor fechado; aberto = valor efetivo; perdido = valor fechado.
        Assert.Equal(
            [
                new PipelineFunnelStageDto(DealStage.Prospect, 4, 4_500m, 1m),
                new PipelineFunnelStageDto(DealStage.PrimeiroContato, 3, 4_200m, 0.75m),
                new PipelineFunnelStageDto(DealStage.ContatoRealizado, 3, 4_200m, 0.75m),
                new PipelineFunnelStageDto(DealStage.Qualificacao, 3, 4_200m, 0.75m),
                new PipelineFunnelStageDto(DealStage.Reuniao, 2, 3_500m, 0.5m),
                new PipelineFunnelStageDto(DealStage.Proposta, 1, 1_500m, 0.25m),
                new PipelineFunnelStageDto(DealStage.Negociacao, 1, 1_500m, 0.25m),
                new PipelineFunnelStageDto(DealStage.Ganho, 1, 1_500m, 0.25m),
            ],
            summary.Funnel);
    }

    [Fact]
    public async Task Sem_negocio_antes_do_periodo_nao_ha_base_anterior()
    {
        using var context = new PipelineTestContext();
        context.AddDeal(context.AdminUserId, Now.AddDays(-5), amount: 1_000m);
        var handler = context.Summary(context.AdminUserId, UserRole.Admin);

        Assert.Null((await handler.Handle(new GetPipelineSummaryQuery(AllOwners), Ct)).Previous);

        context.AddDeal(context.AdminUserId, Now.AddDays(-45), amount: 400m);
        var previous = (await handler.Handle(new GetPipelineSummaryQuery(AllOwners), Ct)).Previous;
        Assert.NotNull(previous);
        Assert.Equal((400m, 1), (previous.PipelineTotal, previous.OpenDeals));
    }

    [Fact]
    public async Task Periodo_anterior_usa_o_valor_vigente_naquele_instante()
    {
        using var context = new PipelineTestContext();
        var deal = context.AddDeal(context.AdminUserId, Now.AddDays(-60), ticket: 1_000m);
        context.ChangeValue(deal, 5_000m, 1_000m, Now.AddDays(-10));

        var summary = await context.Summary(context.AdminUserId, UserRole.Admin).Handle(new GetPipelineSummaryQuery(AllOwners), Ct);

        Assert.Equal(5_000m, summary.Kpis.PipelineTotal);
        Assert.Equal(1_000m, summary.Previous!.PipelineTotal);
        // A série acompanha a troca: 1.000 até o dia da mudança, 5.000 dali em diante.
        Assert.Equal(1_000m, summary.Sparklines.PipelineTotal[0]);
        Assert.Equal(5_000m, summary.Sparklines.PipelineTotal[^1]);
    }

    [Fact]
    public async Task Sparklines_por_dia_ate_31_dias_por_semana_acima_e_o_ultimo_ponto_e_o_KPI()
    {
        using var context = new PipelineTestContext();
        var won = context.AddDeal(context.AdminUserId, Now.AddDays(-20), amount: 1_000m);
        context.Close(won, won: true, Now.AddDays(-4));
        context.AddDeal(context.AdminUserId, Now.AddDays(-12), ticket: 2_000m, path: [DealStage.Proposta]);
        context.AddDeal(context.AdminUserId, Now.AddDays(-50), amount: 600m);
        var handler = context.Summary(context.AdminUserId, UserRole.Admin);

        var month = await handler.Handle(new GetPipelineSummaryQuery(AllOwners), Ct);
        Assert.Equal("day", month.Sparklines.Granularity);
        Assert.Equal(30, month.Sparklines.BucketStarts.Count);
        AssertLastPointIsKpi(month);

        var quarter = await handler.Handle(
            new GetPipelineSummaryQuery(AllOwners, new DateOnly(2026, 6, 18), new DateOnly(2026, 9, 15)), Ct);
        Assert.Equal("week", quarter.Sparklines.Granularity);
        Assert.Equal(13, quarter.Sparklines.BucketStarts.Count);
        Assert.Equal(new DateOnly(2026, 6, 18), quarter.Sparklines.BucketStarts[0]);
        AssertLastPointIsKpi(quarter);
    }

    private static void AssertLastPointIsKpi(PipelineSummaryDto summary)
    {
        var s = summary.Sparklines;
        Assert.Equal(
            summary.Kpis,
            new PipelineKpisDto(s.PipelineTotal[^1], s.ForecastRevenue[^1], s.OpenDeals[^1], s.ConversionRate[^1], s.AverageTicket[^1]));
    }
}
