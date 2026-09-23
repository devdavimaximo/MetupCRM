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

/// <summary>
/// Quanto o pipeline aberto promete fechar em cada mês, pela data que o responsável informou
/// (<c>Deal.ExpectedCloseDate</c>). <see cref="MonthKey"/> sai como "yyyy-MM" (ordenável, sem
/// tradução); <c>null</c> é o balde dos negócios <b>sem previsão informada</b> — que não some do
/// relatório, porque é justamente o que falta preencher. <see cref="IsOverdue"/> marca os meses já
/// vencidos: previsão no passado com negócio ainda aberto.
/// </summary>
public record ForecastMonthDto(
    string? MonthKey,
    bool IsOverdue,
    int OpenDealsCount,
    decimal OpenAmount,
    decimal? WeightedAmount);

/// <summary>
/// Forecast / receita potencial: a fotografia do pipeline aberto <b>hoje</b>, ponderada pela
/// probabilidade histórica de cada estágio. Não depende da janela pedida — um negócio aberto há
/// dois anos continua em aberto, e escondê-lo por causa do período mentiria sobre o pipeline.
/// O período do relatório entra só no histórico que calcula as probabilidades, que usa tudo.
/// </summary>
public record ForecastReportDto(
    ReportPeriodDto Period,
    IReadOnlyList<ForecastByStageDto> ByStage,
    IReadOnlyList<ForecastMonthDto> ByMonth,
    int TotalOpenDeals,
    decimal TotalPipelineAmount,
    decimal TotalWeightedForecast,
    int OpenDealsWithoutExpectedCloseDate);
