using Metup.Domain.Deals;

namespace Metup.Application.Deals.Common;

/// <summary>
/// A etapa que mais recebeu negócios na janela e a fração que ela representa do total de entradas
/// (0–1). <c>Tied</c> lista as outras etapas com o mesmo número de entradas (empate).
/// </summary>
public record PipelineVolumeInsightDto(
    DealStage Stage,
    int Entered,
    int TotalEntered,
    decimal? PctOfTotal,
    IReadOnlyList<DealStage> Tied);

/// <summary>
/// O par de etapas consecutivas com a maior taxa de passagem na janela. Só entram pares com pelo
/// menos <see cref="PipelineInsightsDto.MinimumPassageSample"/> entradas na etapa de origem — sem
/// isso, "1 de 1" venceria sempre.
/// </summary>
public record PipelinePassageInsightDto(
    DealStage FromStage,
    DealStage ToStage,
    int Entered,
    int Advanced,
    decimal Rate,
    IReadOnlyList<DealStage> Tied);

/// <summary>
/// Negócios abertos e parados (<c>StalledDealRule</c> com <c>Organization.StalledDealDays</c>) de
/// Qualificação em diante: quantos e quanto somam pelo valor efetivo.
/// </summary>
public record PipelineRiskInsightDto(int Count, decimal Value, int StalledAfterDays);

/// <summary>
/// Diagnóstico do pipeline na janela dos últimos <see cref="WindowDays"/> dias terminando na
/// referência do período. Cada parte é <c>null</c> quando não há amostra — nada é inventado.
/// </summary>
public record PipelineInsightsDto(
    Guid? OwnerUserId,
    DateOnly WindowStartLocal,
    DateOnly WindowEndLocal,
    PipelineVolumeInsightDto? Volume,
    PipelinePassageInsightDto? BestPassage,
    PipelineRiskInsightDto Risk)
{
    /// <summary>A janela da referência: os últimos 30 dias (item 17 do plano).</summary>
    public const int WindowDays = 30;

    /// <summary>Amostra mínima na etapa de origem para um par disputar a "melhor passagem".</summary>
    public const int MinimumPassageSample = 5;
}
