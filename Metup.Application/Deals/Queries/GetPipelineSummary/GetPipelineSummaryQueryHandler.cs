using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Application.Deals.Analytics;
using Metup.Application.Deals.Common;
using Metup.Domain.Deals;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Deals.Queries.GetPipelineSummary;

/// <summary>
/// KPIs, sparklines e funil do pipeline, sem nenhuma definição própria: valor efetivo de
/// <see cref="DealValue"/>, receita prevista de <see cref="WeightedForecast"/> (probabilidades do mesmo
/// provider do dashboard), ticket médio de <see cref="SalesMetrics"/>, conversão e funil de
/// <see cref="StageAnalytics.CalculateCohortFunnel"/>.
///
/// Cada janela é lida até o instante do fim dela (o fim do período, ou agora se ele termina hoje): o
/// funil conta as transições até ali, e a comparação com a janela anterior fica justa — a coorte
/// anterior não ganha dias a mais para converter.
///
/// Custo: fotografias com subconsultas por negócio (valor e etapa vigentes), uma ida ao banco por
/// ponto da sparkline (até 31 por dia; até 53 por semana num período de um ano). Funil e ganhos da
/// janela são lidos uma vez e fatiados em memória por ponto.
/// </summary>
public class GetPipelineSummaryQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock,
    DealBoardReader reader,
    IStageAnalyticsProvider stageAnalytics) : IRequestHandler<GetPipelineSummaryQuery, PipelineSummaryDto>
{
    public async Task<PipelineSummaryDto> Handle(GetPipelineSummaryQuery request, CancellationToken cancellationToken)
    {
        var scope = currentUserService.ResolveDealOwnerScope(request.Filter.OwnerUserId, request.Filter.AllOwners);
        var clock = await organizationClock.SnapshotAsync(cancellationToken);
        var period = LocalPeriod.Resolve(request.From, request.To, clock.Today, DealBoardReader.DefaultPeriodDays);

        var periodStart = clock.StartOfDayUtc(period.StartLocal);
        var snapshotAt = Earliest(clock.EndOfDayUtc(period.EndLocal), clock.UtcNow);

        var deals = reader.Filtered(scope, request.Filter);
        var probabilities = (await stageAnalytics.GetAsync(scope, cancellationToken)).WinProbabilityByStage;

        var current = await ReadWindowAsync(deals, scope.OrganizationId, periodStart, snapshotAt, probabilities, cancellationToken);

        // Sem negócio nenhum antes do período, não há o que comparar ("Sem base anterior").
        PipelineKpisDto? previous = null;
        if (await deals.AnyAsync(d => d.CreatedAt < periodStart, cancellationToken))
        {
            var previousStart = clock.StartOfDayUtc(period.PreviousStartLocal);
            var previousWindow = await ReadWindowAsync(
                deals, scope.OrganizationId, previousStart, periodStart.AddTicks(-1), probabilities, cancellationToken);
            previous = previousWindow.Kpis;
        }

        var sparklines = await SparklinesAsync(deals, period, clock, periodStart, current, probabilities, cancellationToken);

        var funnel = current.Funnel;
        var funnelStages = funnel.Stages
            .Select(s => new PipelineFunnelStageDto(s.Stage, s.Reached, s.Value, funnel.Top == 0 ? null : (decimal)s.Reached / funnel.Top))
            .ToList();

        return new PipelineSummaryDto(
            scope.OwnerUserId,
            period.StartLocal,
            period.EndLocal,
            snapshotAt,
            current.Kpis,
            previous,
            sparklines,
            funnelStages,
            new PipelineFunnelSummaryDto(funnel.Top, funnel.Won, funnel.ConversionRate));
    }

    /// <summary>Tudo de uma janela [início, fim]: fotografia no fim, ganhos por fechamento, coorte por criação.</summary>
    private async Task<WindowReading> ReadWindowAsync(
        IQueryable<Deal> deals,
        Guid organizationId,
        DateTime start,
        DateTime end,
        IReadOnlyDictionary<DealStage, decimal?> probabilities,
        CancellationToken cancellationToken)
    {
        var snapshot = await deals.PipelineAtAsync(context, end, probabilities, cancellationToken);

        // Receita ganha é só o valor fechado (Amount), como no dashboard.
        var won = await deals
            .Where(d => d.Status == DealStatus.Ganho && d.ClosedAt >= start && d.ClosedAt <= end)
            .Select(d => new WonDeal(d.ClosedAt!.Value, d.Amount ?? 0m))
            .ToListAsync(cancellationToken);

        var cohortQuery = deals.Where(d => d.CreatedAt >= start && d.CreatedAt <= end);

        // Valor que o negócio somava no fim da janela, pela regra de DealValue conforme a situação.
        var cohort = await cohortQuery
            .AtInstant(context, end)
            .Select(DealValue.Project(
                (DealAtInstant r) => r.Amount,
                r => r.Ticket,
                (r, value, _) => new CohortRow(r.Id, r.CreatedAt, r.IsOpen ? value ?? 0m : r.Amount ?? 0m)))
            .ToListAsync(cancellationToken);

        var cohortIds = cohortQuery.Select(d => d.Id);
        var reaches = await context.StageChanges
            .AsNoTracking()
            .Where(sc => sc.OrganizationId == organizationId && cohortIds.Contains(sc.DealId) && sc.ChangedAt <= end)
            .Select(sc => new StageReach(sc.DealId, sc.ToStage, sc.ChangedAt))
            .ToListAsync(cancellationToken);

        var funnel = StageAnalytics.CalculateCohortFunnel(cohort.Select(c => new CohortDeal(c.Id, c.Value)).ToList(), reaches);

        var kpis = new PipelineKpisDto(
            snapshot.PipelineTotal,
            snapshot.ForecastRevenue,
            snapshot.OpenDeals,
            funnel.ConversionRate,
            SalesMetrics.AverageTicket(won.Sum(w => w.Amount), won.Count));

        return new WindowReading(kpis, funnel, cohort, reaches, won);
    }

    /// <summary>
    /// Um ponto por intervalo (<see cref="SeriesBuckets"/>), no fim dele: fotografia no banco;
    /// conversão e ticket acumulados desde o início do período, a partir da leitura da janela.
    /// </summary>
    private async Task<PipelineSparklinesDto> SparklinesAsync(
        IQueryable<Deal> deals,
        LocalPeriod period,
        OrganizationClockSnapshot clock,
        DateTime periodStart,
        WindowReading window,
        IReadOnlyDictionary<DealStage, decimal?> probabilities,
        CancellationToken cancellationToken)
    {
        var buckets = SeriesBuckets.Of(period.StartLocal, period.EndLocal);
        var pipelineTotal = new List<decimal>(buckets.Count);
        var forecast = new List<decimal?>(buckets.Count);
        var openDeals = new List<int>(buckets.Count);
        var conversion = new List<decimal?>(buckets.Count);
        var averageTicket = new List<decimal?>(buckets.Count);

        foreach (var (_, bucketEnd) in buckets)
        {
            var at = Earliest(clock.EndOfDayUtc(bucketEnd), clock.UtcNow);

            var snapshot = await deals.PipelineAtAsync(context, at, probabilities, cancellationToken);
            pipelineTotal.Add(snapshot.PipelineTotal);
            forecast.Add(snapshot.ForecastRevenue);
            openDeals.Add(snapshot.OpenDeals);

            var cohortSoFar = window.Cohort
                .Where(c => c.CreatedAt >= periodStart && c.CreatedAt <= at)
                .Select(c => new CohortDeal(c.Id, c.Value))
                .ToList();
            conversion.Add(StageAnalytics.CalculateCohortFunnel(cohortSoFar, window.Reaches.Where(r => r.ChangedAt <= at)).ConversionRate);

            var wonSoFar = window.Won.Where(w => w.ClosedAt <= at).ToList();
            averageTicket.Add(SalesMetrics.AverageTicket(wonSoFar.Sum(w => w.Amount), wonSoFar.Count));
        }

        return new PipelineSparklinesDto(
            SeriesBuckets.Granularity(period.Days),
            buckets.Select(b => b.Start).ToList(),
            pipelineTotal,
            forecast,
            openDeals,
            conversion,
            averageTicket);
    }

    private static DateTime Earliest(DateTime a, DateTime b) => a <= b ? a : b;

    private sealed record WonDeal(DateTime ClosedAt, decimal Amount);

    private sealed record CohortRow(Guid Id, DateTime CreatedAt, decimal Value);

    private sealed record WindowReading(
        PipelineKpisDto Kpis,
        CohortFunnel Funnel,
        IReadOnlyList<CohortRow> Cohort,
        IReadOnlyList<StageReach> Reaches,
        IReadOnlyList<WonDeal> Won);
}
