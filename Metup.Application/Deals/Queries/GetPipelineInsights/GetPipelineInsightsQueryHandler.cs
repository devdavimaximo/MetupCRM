using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Application.Deals.Analytics;
using Metup.Application.Deals.Common;
using Metup.Domain.Deals;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Deals.Queries.GetPipelineInsights;

/// <summary>
/// Os três cards do rodapé, todos lidos no banco e sem definição nova: volume e passagem saem de
/// <c>StageChange</c> pelo <see cref="StageAnalytics"/>; o risco usa o mesmo "parado" do quadro
/// (<see cref="StalledDealRule"/> com o limite da organização) e o mesmo valor de
/// <see cref="DealValue"/>. Custo: duas consultas (transições da janela e agregado dos parados).
/// </summary>
public class GetPipelineInsightsQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock,
    DealBoardReader reader) : IRequestHandler<GetPipelineInsightsQuery, PipelineInsightsDto>
{
    /// <summary>O risco olha do meio do funil para frente — antes de Qualificação, parar é normal.</summary>
    private static readonly IReadOnlyList<DealStage> RiskStages =
        DealBoardReader.ActiveStages.Where(s => s >= DealStage.Qualificacao).ToList();

    public async Task<PipelineInsightsDto> Handle(GetPipelineInsightsQuery request, CancellationToken cancellationToken)
    {
        var scope = currentUserService.ResolveDealOwnerScope(request.Filter.OwnerUserId, request.Filter.AllOwners);
        var clock = await organizationClock.SnapshotAsync(cancellationToken);
        var period = LocalPeriod.Resolve(request.From, request.To, clock.Today, DealBoardReader.DefaultPeriodDays);
        var boardClock = await reader.BoardClockAsync(scope.OrganizationId, clock, cancellationToken);

        var windowEnd = period.EndLocal;
        var windowStart = windowEnd.AddDays(-(PipelineInsightsDto.WindowDays - 1));
        var start = clock.StartOfDayUtc(windowStart);
        var end = clock.EndOfDayUtc(windowEnd);

        var deals = reader.Filtered(scope, request.Filter);
        var dealIds = deals.Select(d => d.Id);

        var reaches = await context.StageChanges
            .AsNoTracking()
            .Where(sc => sc.OrganizationId == scope.OrganizationId
                && dealIds.Contains(sc.DealId)
                && sc.ChangedAt >= start
                && sc.ChangedAt <= end)
            .Select(sc => new StageReach(sc.DealId, sc.ToStage, sc.ChangedAt))
            .ToListAsync(cancellationToken);

        return new PipelineInsightsDto(
            scope.OwnerUserId,
            windowStart,
            windowEnd,
            Volume(reaches),
            BestPassage(reaches),
            await RiskAsync(reader, scope, request.Filter, boardClock, cancellationToken));
    }

    /// <summary>Entradas por etapa ativa na janela — a transição de nascimento conta como entrada no topo.</summary>
    private static PipelineVolumeInsightDto? Volume(IReadOnlyList<StageReach> reaches)
    {
        var byStage = DealBoardReader.ActiveStages
            .Select(stage => (Stage: stage, Entered: reaches.Count(r => r.ToStage == stage)))
            .Where(s => s.Entered > 0)
            .ToList();

        if (byStage.Count == 0)
        {
            return null;
        }

        var total = byStage.Sum(s => s.Entered);
        var top = byStage.Max(s => s.Entered);
        var leaders = byStage.Where(s => s.Entered == top).Select(s => s.Stage).ToList();

        return new PipelineVolumeInsightDto(
            leaders[0],
            top,
            total,
            total == 0 ? null : (decimal)top / total,
            leaders.Skip(1).ToList());
    }

    private static PipelinePassageInsightDto? BestPassage(IReadOnlyList<StageReach> reaches)
    {
        var eligible = StageAnalytics
            .CalculateConsecutivePassages(DealBoardReader.ActiveStages, reaches)
            .Where(p => p.Entered >= PipelineInsightsDto.MinimumPassageSample && p.Advanced > 0)
            .ToList();

        if (eligible.Count == 0)
        {
            return null;
        }

        var best = eligible.Max(p => p.Rate);
        var leaders = eligible.Where(p => p.Rate == best).ToList();
        var winner = leaders[0];

        return new PipelinePassageInsightDto(
            winner.FromStage,
            winner.ToStage,
            winner.Entered,
            winner.Advanced,
            winner.Rate,
            leaders.Skip(1).Select(p => p.FromStage).ToList());
    }

    /// <summary>
    /// Os parados do próprio quadro: o mesmo filtro <c>StalledOnly</c> que a lista usa, recortado de
    /// Qualificação em diante. Contagem e soma saem agregadas do banco.
    /// </summary>
    private static async Task<PipelineRiskInsightDto> RiskAsync(
        DealBoardReader reader,
        DealScopeFilter scope,
        DealPipelineFilter filter,
        BoardClock boardClock,
        CancellationToken cancellationToken)
    {
        var totals = await reader
            .Filtered(scope, filter with { StalledOnly = true }, boardClock)
            .Where(d => RiskStages.Contains(d.Stage))
            .Select(DealValue.Project((d, value, _) => new { Value = value }))
            .GroupBy(_ => 1)
            .Select(g => new { Count = g.Count(), Value = g.Sum(r => r.Value ?? 0m) })
            .FirstOrDefaultAsync(cancellationToken);

        return new PipelineRiskInsightDto(totals?.Count ?? 0, totals?.Value ?? 0m, boardClock.StalledDealDays);
    }
}
