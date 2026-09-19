using Metup.Application.Common.Interfaces;
using Metup.Application.Deals.Common;
using Metup.Domain.Deals;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Deals.Analytics;

/// <summary>
/// O pipeline aberto num instante: soma do valor efetivo vigente, receita prevista (ponderada) e
/// quantidade de abertos. Com o instante = agora, é o mesmo número do pipeline e da receita prevista
/// do dashboard.
/// </summary>
public sealed record PipelineSnapshot(decimal PipelineTotal, decimal? ForecastRevenue, int OpenDeals);

public static class PipelineSnapshots
{
    /// <summary>
    /// Um <c>GROUP BY</c> pela etapa vigente, somando o valor vigente (<see cref="DealAtInstant"/>).
    /// A probabilidade de ganho é a de hoje: o histórico dela não é guardado.
    /// </summary>
    public static async Task<PipelineSnapshot> PipelineAtAsync(
        this IQueryable<Deal> deals,
        IApplicationDbContext context,
        DateTime instantUtc,
        IReadOnlyDictionary<DealStage, decimal?> winProbabilityByStage,
        CancellationToken cancellationToken)
    {
        var byStage = await deals
            .AtInstant(context, instantUtc)
            .Where(r => r.IsOpen)
            .Select(DealValue.Project((DealAtInstant r) => r.Amount, r => r.Ticket, (r, value, _) => new { r.Stage, Value = value }))
            .GroupBy(r => r.Stage)
            .Select(g => new { Stage = g.Key, Count = g.Count(), Total = g.Sum(r => r.Value ?? 0m) })
            .ToListAsync(cancellationToken);

        return new PipelineSnapshot(
            byStage.Sum(s => s.Total),
            WeightedForecast.FromStageTotals(byStage.Select(s => (s.Stage, s.Total)), winProbabilityByStage),
            byStage.Sum(s => s.Count));
    }
}
