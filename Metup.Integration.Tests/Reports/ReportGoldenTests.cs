using Metup.Application.Reports.Common;
using Metup.Domain.Deals;
using Xunit;
using static Metup.Integration.Tests.Reports.ReportScenario;

namespace Metup.Integration.Tests.Reports;

/// <summary>
/// Testes dourados dos relatórios (F0.7): a massa de <see cref="ReportScenario"/> contra Postgres real,
/// com os números esperados calculados à mão. É a rede de segurança antes de qualquer refatoração dos
/// relatórios — se um número mudar aqui, ou a regra mudou de propósito (e o teste muda junto, com a
/// conta nova) ou é bug.
///
/// Taxas são comparadas com 4 casas: o que importa é a conta, não a última casa do decimal.
/// </summary>
public class ReportGoldenTests(ReportScenario scenario) : IClassFixture<ReportScenario>
{
    private static readonly DateOnly August1 = new(2026, 8, 1);

    [Fact]
    public async Task Periodo_resolvido_no_fuso_da_organizacao_com_janela_anterior_e_inicio_do_historico()
    {
        await using var reports = scenario.Runner();

        var period = (await reports.Funnel(September1, September30)).Period;

        Assert.Equal(30, period.Days);
        Assert.Equal(new DateTime(2026, 9, 1, 3, 0, 0, DateTimeKind.Utc), period.PeriodStart); // 00:00 local
        Assert.Equal(new DateTime(2026, 10, 1, 3, 0, 0, DateTimeKind.Utc).AddTicks(-1), period.PeriodEnd);
        Assert.Equal(new DateTime(2026, 8, 2, 3, 0, 0, DateTimeKind.Utc), period.PreviousStart); // 30 dias antes
        Assert.Equal(September1, period.PeriodStartLocal);
        Assert.Equal(September30, period.PeriodEndLocal);
        Assert.Equal(At(6, 1), period.HistoryStart); // D6, o negócio mais antigo — da organização, não da vizinha
    }

    [Fact]
    public async Task Funil_em_coorte_conta_quem_alcancou_cada_etapa_ou_foi_alem()
    {
        await using var reports = scenario.Runner();

        var report = await reports.Funnel(September1, September30);

        // Coorte de setembro (local): D1, D2, D3. D4 é 01/09 em UTC mas 31/08 local → fica de fora.
        Assert.Equal(3, report.CohortSize);
        Assert.Equal(1, report.LostCount); // D2
        AssertRate(1m / 3m, report.CohortConversionRate); // só D1 ganhou
        AssertRate(0.25m, report.PreviousCohortConversionRate); // D4, D5, D7, D8 → só D5

        // Mais longe: D1 Ganho · D2 1º contato · D3 Qualificação (pulou duas etapas, que contam).
        // Valor = Amount ?? Ticket: D1 12.000 (fechado) · D2 5.000 (ticket) · D3 8.000.
        // Dias na etapa (só quem saiu dela): Prospect 2/2/2 → 2 · 1º contato 6 (D1) e 5 (D2) → 5,5 ·
        // Reunião 5 · Proposta 5 · as demais sem amostra.
        AssertStep(report, DealStage.Prospect, reached: 3, value: 25_000m, stepRate: 1m, topRate: 1m, days: 2);
        AssertStep(report, DealStage.PrimeiroContato, 3, 25_000m, 1m, 1m, 5.5);
        AssertStep(report, DealStage.ContatoRealizado, 2, 20_000m, 2m / 3m, 2m / 3m, null);
        AssertStep(report, DealStage.Qualificacao, 2, 20_000m, 1m, 2m / 3m, null);
        AssertStep(report, DealStage.Reuniao, 1, 12_000m, 0.5m, 1m / 3m, 5);
        AssertStep(report, DealStage.Proposta, 1, 12_000m, 1m, 1m / 3m, 5);
        AssertStep(report, DealStage.Negociacao, 1, 12_000m, 1m, 1m / 3m, null);
        AssertStep(report, DealStage.Ganho, 1, 12_000m, 1m, 1m / 3m, null);

        // Onde a coorte está hoje.
        Assert.Equal(
            [(DealStage.Qualificacao, 1), (DealStage.Ganho, 1), (DealStage.Perdido, 1)],
            report.DealsByStage.Select(s => (s.Stage, s.Count)));

        // Transições observadas da coorte (o nascimento, sem "de", não conta).
        Assert.Equal(
            [
                (DealStage.Prospect, DealStage.PrimeiroContato, 2),
                (DealStage.Prospect, DealStage.Qualificacao, 1),
                (DealStage.PrimeiroContato, DealStage.Reuniao, 1),
                (DealStage.PrimeiroContato, DealStage.Perdido, 1),
                (DealStage.Reuniao, DealStage.Proposta, 1),
                (DealStage.Proposta, DealStage.Ganho, 1),
            ],
            report.StageConversions.Select(c => (c.FromStage, c.ToStage, c.Count)));
    }

    [Fact]
    public async Task Metrica_de_ouro_usa_esforco_e_receita_do_periodo_com_borda_de_fuso()
    {
        await using var reports = scenario.Runner();

        var golden = (await reports.Funnel(September1, September30)).GoldenMetric;

        // Ligações: 6 no período (inclui 30/09 23:00 local) · 3 na anterior (inclui 31/08 23:59 local).
        // O WhatsApp, a ligação de julho e as 5 da vizinha não contam.
        Assert.Equal(6m, golden.Calls.Current);
        Assert.Equal(3m, golden.Calls.Previous);

        // Receita por data de fechamento: D1 12.000 + D6 6.000 (criado em junho, fechado em setembro).
        // Anterior: D5 4.000. A venda de 999.999 da vizinha não entra.
        Assert.Equal(18_000m, golden.ClosedRevenue.Current);
        Assert.Equal(4_000m, golden.ClosedRevenue.Previous);

        AssertRate(6m / (18_000m / 5_000m), golden.CallsPerFiveThousand); // 1,6667
        AssertRate(3m / (4_000m / 5_000m), golden.PreviousCallsPerFiveThousand); // 3,75
    }

    [Fact]
    public async Task Tempo_ate_fechar_mede_os_ganhos_do_periodo_com_distribuicao()
    {
        await using var reports = scenario.Runner();

        var isolated = (await reports.TimeToClose(September1, September30)).TimeToClose;
        var embedded = (await reports.Funnel(September1, September30)).TimeToClose;

        // Ganhos em setembro: D1 (02/09 → 20/09 = 18 dias) e D6 (01/06 → 25/09 = 116 dias) → média 67.
        // Anterior: D5 (10/08 → 20/08 = 10 dias).
        foreach (var timeToClose in new[] { isolated, embedded })
        {
            Assert.Equal(2, timeToClose.WonDealsCount);
            Assert.Equal(67, timeToClose.AverageDaysToClose!.Value, 6);
            Assert.Equal(10, timeToClose.PreviousAverageDaysToClose!.Value, 6);
            Assert.Equal(
                [(7, 0), (15, 0), (30, 1), (60, 0), ((int?)null, 1)],
                timeToClose.Distribution.Select(b => (b.UpToDays, b.Count)));
        }
    }

    [Fact]
    public async Task Desempenho_por_responsavel_separa_periodo_anterior_e_fotografia_do_aberto()
    {
        await using var reports = scenario.Runner();

        var report = await reports.ByOwner(September1, September30);

        Assert.Equal(["Ana", "Bruno"], report.Groups.Select(g => g.GroupLabel));

        // Ana: ganhou D1 (12.000) em setembro; em aberto D3 (8.000) e D8 (1.000);
        // anterior: ganhou D5 (4.000), perdeu D7 → 50%.
        AssertGroup(report.Groups[0], open: 2, openAmount: 9_000m, won: 1, lost: 0, closeRate: 1m,
            averageTicket: 12_000m, revenue: 12_000m, previousWon: 1, previousRevenue: 4_000m, previousCloseRate: 0.5m);

        // Bruno: ganhou D6 (6.000) e perdeu D2 em setembro; em aberto D4 (3.000); nada na anterior.
        AssertGroup(report.Groups[1], 1, 3_000m, 1, 1, 0.5m, 6_000m, 6_000m, 0, 0m, null);

        Assert.Equal(2, report.Totals.Groups);
        Assert.Equal(3, report.Totals.OpenDeals);
        Assert.Equal(12_000m, report.Totals.OpenAmount);
        Assert.Equal(2, report.Totals.WonDeals);
        Assert.Equal(1, report.Totals.LostDeals);
        AssertRate(2m / 3m, report.Totals.CloseRate);
        Assert.Equal(9_000m, report.Totals.AverageTicket);
        Assert.Equal(18_000m, report.Totals.Revenue.Current);
        Assert.Equal(4_000m, report.Totals.Revenue.Previous);
    }

    [Fact]
    public async Task Desempenho_por_segmento_mantem_o_grupo_sem_segmento()
    {
        await using var reports = scenario.Runner();

        var report = await reports.BySegment(September1, September30);

        Assert.Equal(["Saúde", "Sem segmento", "Varejo"], report.Groups.Select(g => g.GroupLabel));
        // Saúde: D1 ganho (12.000) · anterior D5 ganho, D7 perdido.
        AssertGroup(report.Groups[0], 0, 0m, 1, 0, 1m, 12_000m, 12_000m, 1, 4_000m, 0.5m);
        // Sem segmento: D3 e D8 abertos, nada fechado → taxa e ticket nulos, nunca zero.
        AssertGroup(report.Groups[1], 2, 9_000m, 0, 0, null, null, 0m, 0, 0m, null);
        // Varejo: D6 ganho, D2 perdido, D4 aberto.
        AssertGroup(report.Groups[2], 1, 3_000m, 1, 1, 0.5m, 6_000m, 6_000m, 0, 0m, null);
    }

    [Fact]
    public async Task Desempenho_por_origem_agrupa_pelo_nome_do_enum()
    {
        await using var reports = scenario.Runner();

        var report = await reports.BySource(September1, September30);

        Assert.Equal(["Indicacao", "MetaAds", "Sdr"], report.Groups.Select(g => g.GroupKey));
        // Indicação: D6 ganho (6.000), D3 aberto (8.000).
        AssertGroup(report.Groups[0], 1, 8_000m, 1, 0, 1m, 6_000m, 6_000m, 0, 0m, null);
        // Meta Ads: D2 perdido → taxa 0 (houve fechamento), ticket nulo (nenhum ganho).
        AssertGroup(report.Groups[1], 0, 0m, 0, 1, 0m, null, 0m, 0, 0m, null);
        // SDR: D1 ganho (12.000); abertos D4 (3.000) e D8 (1.000); anterior D5 ganho, D7 perdido.
        AssertGroup(report.Groups[2], 2, 4_000m, 1, 0, 1m, 12_000m, 12_000m, 1, 4_000m, 0.5m);
    }

    [Fact]
    public async Task Safras_cortam_o_mes_no_fuso_da_organizacao()
    {
        await using var reports = scenario.Runner();

        var report = await reports.Cohorts(August1, September30);

        Assert.Equal(["2026-08", "2026-09"], report.Cohorts.Select(c => c.CohortKey));

        // Agosto: D4 (31/08 local, apesar de 01/09 em UTC), D5, D7, D8 → D5 ganho (4.000, 10 dias), D7 perdido.
        var august = report.Cohorts[0];
        Assert.Equal((4, 2, 1, 1), (august.TotalDeals, august.OpenDeals, august.WonDeals, august.LostDeals));
        AssertRate(0.5m, august.CloseRate);
        Assert.Equal(4_000m, august.AverageTicket);
        Assert.Equal(4_000m, august.TotalRevenue);
        Assert.Equal(10, august.AverageDaysToClose!.Value, 6);

        // Setembro: D1 ganho (12.000, 18 dias), D2 perdido, D3 aberto.
        var september = report.Cohorts[1];
        Assert.Equal((3, 1, 1, 1), (september.TotalDeals, september.OpenDeals, september.WonDeals, september.LostDeals));
        AssertRate(0.5m, september.CloseRate);
        Assert.Equal(12_000m, september.AverageTicket);
        Assert.Equal(12_000m, september.TotalRevenue);
        Assert.Equal(18, september.AverageDaysToClose!.Value, 6);
    }

    [Fact]
    public async Task Forecast_pondera_o_pipeline_de_hoje_pela_probabilidade_historica()
    {
        await using var reports = scenario.Runner();

        var report = await reports.Forecast(September1, September30);

        // Probabilidade (fechados que passaram pela etapa): Prospect → D1 G, D2 P, D5 G, D6 G, D7 P = 3/5.
        // Qualificação → só D3, ainda aberto → sem amostra → sem ponderado (nunca probabilidade inventada).
        // Abertos hoje: D4 e D8 em Prospect (3.000 + 1.000), D3 em Qualificação (8.000).
        Assert.Equal(2, report.ByStage.Count);
        AssertStage(report.ByStage[0], DealStage.Prospect, 2, 4_000m, 0.6m, 2_400m);
        AssertStage(report.ByStage[1], DealStage.Qualificacao, 1, 8_000m, null, null);

        Assert.Equal(3, report.TotalOpenDeals);
        Assert.Equal(12_000m, report.TotalPipelineAmount);
        Assert.Equal(2_400m, report.TotalWeightedForecast);
        Assert.Equal(1, report.OpenDealsWithoutExpectedCloseDate); // D4

        // Por mês da previsão: D8 em 08/2026 (vencido), D3 em 10/2026, D4 sem previsão (no fim).
        Assert.Equal(
            [
                ("2026-08", true, 1, 1_000m, (decimal?)600m),
                ("2026-10", false, 1, 8_000m, null),
                (null, false, 1, 3_000m, 1_800m),
            ],
            report.ByMonth.Select(m => (m.MonthKey, m.IsOverdue, m.OpenDealsCount, m.OpenAmount, Round(m.WeightedAmount))));
    }

    private static void AssertStep(
        FunnelReportDto report, DealStage stage, int reached, decimal value, decimal? stepRate, decimal? topRate, double? days)
    {
        var step = report.Funnel.Single(s => s.Stage == stage);
        Assert.Equal(reached, step.Reached);
        Assert.Equal(value, step.Value);
        AssertRate(stepRate, step.StepRate);
        AssertRate(topRate, step.TopRate);
        if (days is null)
        {
            Assert.Null(step.AverageDays);
        }
        else
        {
            Assert.Equal(days.Value, step.AverageDays!.Value, 6);
        }
    }

    private static void AssertGroup(
        SalesPerformanceGroupDto group,
        int open,
        decimal openAmount,
        int won,
        int lost,
        decimal? closeRate,
        decimal? averageTicket,
        decimal revenue,
        int previousWon,
        decimal previousRevenue,
        decimal? previousCloseRate)
    {
        Assert.Equal(open, group.OpenDeals);
        Assert.Equal(openAmount, group.OpenAmount);
        Assert.Equal(won, group.WonDeals);
        Assert.Equal(lost, group.LostDeals);
        AssertRate(closeRate, group.CloseRate);
        Assert.Equal(averageTicket, group.AverageTicket);
        Assert.Equal(revenue, group.TotalRevenue);
        Assert.Equal(previousWon, group.PreviousWonDeals);
        Assert.Equal(previousRevenue, group.PreviousRevenue);
        AssertRate(previousCloseRate, group.PreviousCloseRate);
    }

    private static void AssertStage(
        ForecastByStageDto stage, DealStage expectedStage, int count, decimal amount, decimal? probability, decimal? weighted)
    {
        Assert.Equal(expectedStage, stage.Stage);
        Assert.Equal(count, stage.OpenDealsCount);
        Assert.Equal(amount, stage.OpenAmount);
        AssertRate(probability, stage.WinProbability);
        Assert.Equal(weighted, Round(stage.WeightedAmount));
    }

    private static void AssertRate(decimal? expected, decimal? actual) =>
        Assert.Equal(Round(expected, 4), Round(actual, 4));

    private static decimal? Round(decimal? value, int decimals = 2) =>
        value is { } v ? Math.Round(v, decimals) : null;
}
