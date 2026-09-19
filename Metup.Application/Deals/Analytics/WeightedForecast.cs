using Metup.Domain.Deals;

namespace Metup.Application.Deals.Analytics;

/// <summary>
/// Receita prevista: o valor aberto de cada etapa ponderado pela probabilidade histórica de ganho
/// dela (<see cref="StageAnalytics.CalculateWinProbabilities"/>). Uma regra só para o dashboard, o
/// resumo e a evolução do pipeline. Etapa sem probabilidade não contribui; sem probabilidade em
/// nenhuma etapa não há previsão honesta, e o resultado é <c>null</c>.
/// </summary>
public static class WeightedForecast
{
    public static decimal? FromStageTotals(
        IEnumerable<(DealStage Stage, decimal Amount)> openAmountByStage,
        IReadOnlyDictionary<DealStage, decimal?> winProbabilityByStage)
    {
        var weighted = openAmountByStage
            .Select(s => winProbabilityByStage.GetValueOrDefault(s.Stage) is { } probability
                ? s.Amount * probability
                : (decimal?)null)
            .ToList();

        return weighted.Any(w => w.HasValue) ? weighted.Sum(w => w ?? 0m) : null;
    }
}
