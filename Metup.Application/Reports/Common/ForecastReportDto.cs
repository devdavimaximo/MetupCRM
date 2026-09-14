using Metup.Domain.Deals;

namespace Metup.Application.Reports.Common;

/// <summary>
/// Pipeline aberto num estágio: quanto está em jogo e a probabilidade de fechar como ganho,
/// observada historicamente (StageChange dos negócios já fechados que passaram por este estágio).
/// <see cref="WinProbability"/> e <see cref="WeightedAmount"/> ficam <c>null</c> quando não há
/// histórico suficiente — nunca uma probabilidade inventada.
/// </summary>
public record ForecastByStageDto(
    DealStage Stage,
    int OpenDealsCount,
    decimal OpenAmount,
    decimal? WinProbability,
    decimal? WeightedAmount);

public record ForecastReportDto(
    IReadOnlyList<ForecastByStageDto> ByStage,
    int TotalOpenDeals,
    decimal TotalPipelineAmount,
    decimal TotalWeightedForecast);
