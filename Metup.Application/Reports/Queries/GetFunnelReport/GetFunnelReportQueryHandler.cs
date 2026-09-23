using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Application.Deals.Analytics;
using Metup.Application.Reports.Common;
using Metup.Domain.Activities;
using Metup.Domain.Deals;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Reports.Queries.GetFunnelReport;

/// <summary>
/// O funil do período (V3, seção 7 do CLAUDE.md), lido de StageChange — nunca do Stage atual do
/// Deal, que só mostra o presente.
///
/// Duas perguntas diferentes, dois recortes diferentes, ambos explícitos:
/// <list type="bullet">
/// <item><b>Funil e safra</b> (coorte): os negócios que <i>entraram</i> no período
/// (<c>Deal.CreatedAt</c>) e até onde cada um chegou.</item>
/// <item><b>Esforço e resultado</b> (métrica de ouro, tempo até fechar): o que <i>aconteceu</i> no
/// período — ligações por <c>Activity.OccurredAt</c>, receita e fechamentos por
/// <c>Deal.ClosedAt</c> — mesma convenção do dashboard, e a única que torna a comparação com a
/// janela anterior legítima.</item>
/// </list>
/// </summary>
public class GetFunnelReportQueryHandler(
    IApplicationDbContext context,
    ReportPeriodResolver periodResolver) : IRequestHandler<GetFunnelReportQuery, FunnelReportDto>
{
    public async Task<FunnelReportDto> Handle(GetFunnelReportQuery request, CancellationToken cancellationToken)
    {
        var window = await periodResolver.ResolveAsync(request, cancellationToken);

        // ── Coorte: quem entrou no funil na janela atual e na anterior ───────────────────────────
        var createdDeals = await periodResolver.DealsCreatedInWindow(window)
            .Select(d => new { d.Id, d.Stage, d.Status, d.Amount, d.Ticket, d.CreatedAt })
            .ToListAsync(cancellationToken);

        var cohort = createdDeals.Where(d => window.InPeriod(d.CreatedAt)).ToList();
        var previousCohort = createdDeals.Where(d => window.InPrevious(d.CreatedAt)).ToList();

        var cohortIds = createdDeals.Select(d => d.Id).ToList();
        var stageChanges = await context.StageChanges
            .AsNoTracking()
            .Where(sc => sc.OrganizationId == window.OrganizationId && cohortIds.Contains(sc.DealId))
            .Select(sc => new { sc.DealId, sc.FromStage, sc.ToStage, sc.ChangedAt })
            .ToListAsync(cancellationToken);

        var reachesByDeal = stageChanges
            .Select(sc => new StageReach(sc.DealId, sc.ToStage, sc.ChangedAt))
            .ToLookup(r => r.DealId);

        List<StageReach> ReachesOf(IEnumerable<Guid> dealIds) =>
            dealIds.SelectMany(id => reachesByDeal[id]).ToList();

        var cohortReaches = ReachesOf(cohort.Select(d => d.Id));
        var funnel = StageAnalytics.CalculateCohortFunnel(
            cohort.Select(d => new CohortDeal(d.Id, d.Amount ?? d.Ticket ?? 0m)).ToList(),
            cohortReaches);

        var previousFunnel = StageAnalytics.CalculateCohortFunnel(
            previousCohort.Select(d => new CohortDeal(d.Id, d.Amount ?? d.Ticket ?? 0m)).ToList(),
            ReachesOf(previousCohort.Select(d => d.Id)));

        var averageDaysInStage = StageAnalytics.CalculateAverageDaysInStage(cohortReaches);

        var steps = funnel.Stages
            .Select((stage, index) =>
            {
                var previousReached = index == 0 ? funnel.Top : funnel.Stages[index - 1].Reached;
                return new FunnelStepDto(
                    stage.Stage,
                    stage.Reached,
                    stage.Value,
                    previousReached == 0 ? null : (decimal)stage.Reached / previousReached,
                    funnel.Top == 0 ? null : (decimal)stage.Reached / funnel.Top,
                    averageDaysInStage.TryGetValue(stage.Stage, out var days) ? days : null);
            })
            .ToList();

        var dealsByStage = cohort
            .GroupBy(d => d.Stage)
            .Select(g => new DealsByStageDto(g.Key, g.Count()))
            .OrderBy(d => d.Stage)
            .ToList();

        var cohortIdSet = cohort.Select(d => d.Id).ToHashSet();
        var stageConversions = stageChanges
            .Where(sc => sc.FromStage.HasValue && cohortIdSet.Contains(sc.DealId))
            .GroupBy(sc => (From: sc.FromStage!.Value, sc.ToStage))
            .Select(g => new StageConversionDto(g.Key.From, g.Key.ToStage, g.Count()))
            .OrderBy(c => c.FromStage)
            .ThenBy(c => c.ToStage)
            .ToList();

        // ── Esforço e resultado do período (não da coorte) ───────────────────────────────────────
        var calls = await context.Activities
            .AsNoTracking()
            .Where(a => a.OrganizationId == window.OrganizationId
                && a.Type == ActivityType.Call
                && a.OccurredAt >= window.PreviousStart
                && a.OccurredAt <= window.PeriodEnd)
            .Select(a => a.OccurredAt)
            .ToListAsync(cancellationToken);

        var closedWon = await context.Deals
            .AsNoTracking()
            .Where(d => d.OrganizationId == window.OrganizationId
                && d.Status == DealStatus.Ganho
                && d.ClosedAt != null
                && d.ClosedAt >= window.PreviousStart
                && d.ClosedAt <= window.PeriodEnd)
            .Select(d => new { d.CreatedAt, ClosedAt = d.ClosedAt!.Value, d.Amount })
            .ToListAsync(cancellationToken);

        double DaysToClose(DateTime createdAt, DateTime closedAt) => (closedAt - createdAt).TotalDays;

        var callsValue = new PeriodValueDto(
            calls.Count(at => window.InPeriod(at)),
            calls.Count(at => window.InPrevious(at)));

        var revenueValue = new PeriodValueDto(
            closedWon.Where(d => window.InPeriod(d.ClosedAt)).Sum(d => d.Amount ?? 0m),
            closedWon.Where(d => window.InPrevious(d.ClosedAt)).Sum(d => d.Amount ?? 0m));

        var goldenMetric = new GoldenMetricDto(
            callsValue,
            revenueValue,
            CallsPerFiveThousand(callsValue.Current, revenueValue.Current),
            CallsPerFiveThousand(callsValue.Previous, revenueValue.Previous));

        // Os negócios ganhos do período já estão carregados para a receita — o tempo até fechar sai
        // deles, pela mesma definição do endpoint isolado (TimeToCloseReader).
        var timeToClose = TimeToCloseReader.From(
            closedWon.Where(d => window.InPeriod(d.ClosedAt)).Select(d => DaysToClose(d.CreatedAt, d.ClosedAt)).ToList(),
            closedWon.Where(d => window.InPrevious(d.ClosedAt)).Select(d => DaysToClose(d.CreatedAt, d.ClosedAt)).ToList());

        return new FunnelReportDto(
            window.Period,
            steps,
            funnel.Top,
            cohort.Count(d => d.Status == DealStatus.Perdido),
            funnel.ConversionRate,
            previousFunnel.ConversionRate,
            dealsByStage,
            stageConversions,
            goldenMetric,
            timeToClose);
    }

    private static decimal? CallsPerFiveThousand(decimal calls, decimal revenue) =>
        revenue > 0 ? calls / (revenue / 5000m) : null;
}
