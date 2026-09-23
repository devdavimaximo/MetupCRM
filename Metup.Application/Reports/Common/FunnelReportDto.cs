using Metup.Application.Common.Models;
using Metup.Domain.Deals;

namespace Metup.Application.Reports.Common;

/// <summary>Onde os negócios da coorte estão hoje — a fotografia, ao lado do caminho percorrido.</summary>
public record DealsByStageDto(DealStage Stage, int Count);

/// <summary>
/// Uma etapa do funil em coorte: quantos negócios que entraram no período <b>alcançaram</b> esta
/// etapa (ou foram além) e quanto valor eles somam. <see cref="StepRate"/> é a passagem desde a
/// etapa anterior; <see cref="TopRate"/>, a conversão desde o topo — as duas leituras que o SDR
/// pede ("onde perdemos gente?" e "quanto do que entra chega aqui?").
/// <see cref="AverageDays"/> é o tempo médio parado na etapa, <c>null</c> sem amostra.
/// </summary>
public record FunnelStepDto(
    DealStage Stage,
    int Reached,
    decimal Value,
    decimal? StepRate,
    decimal? TopRate,
    double? AverageDays);

/// <summary>Transição observada de estágio a estágio, contada a partir de StageChange (não do Stage atual).</summary>
public record StageConversionDto(DealStage FromStage, DealStage ToStage, int Count);

/// <summary>
/// A métrica de ouro (seção 2/7 do CLAUDE.md): quantas ligações, em média, para gerar R$ 5.000.
/// Ligações contam por <c>Activity.OccurredAt</c> e receita por <c>Deal.ClosedAt</c> — o esforço e
/// o resultado <b>do período</b>, não da coorte; é o que torna a comparação com a janela anterior
/// legítima. Sem receita fechada não há divisão: <c>null</c>, nunca zero.
/// </summary>
public record GoldenMetricDto(
    PeriodValueDto Calls,
    PeriodValueDto ClosedRevenue,
    decimal? CallsPerFiveThousand,
    decimal? PreviousCallsPerFiveThousand);

/// <summary>
/// Quantos negócios ganhos levaram até <see cref="UpToDays"/> dias para fechar (<c>null</c> no
/// último balde: daí para cima). Distribuição, não média — é ela que mostra a cauda longa que a
/// média esconde.
/// </summary>
public record DurationBucketDto(int? UpToDays, int Count);

/// <summary>
/// Tempo ponta a ponta do funil: dias entre <c>Deal.CreatedAt</c> e <c>Deal.ClosedAt</c> dos
/// negócios <b>ganhos no período</b> (por ClosedAt), com a mesma leitura na janela anterior.
/// Diferente de <see cref="FunnelStepDto.AverageDays"/>, que mede o tempo dentro de uma etapa.
/// </summary>
public record TimeToCloseDto(
    int WonDealsCount,
    double? AverageDaysToClose,
    double? PreviousAverageDaysToClose,
    IReadOnlyList<DurationBucketDto> Distribution);

/// <summary>
/// O funil do período por inteiro: o caminho percorrido pela coorte que entrou (por
/// <c>Deal.CreatedAt</c>), onde ela está hoje, as transições observadas, o tempo até fechar e a
/// métrica de ouro. Tudo sai de StageChange e Activity — nunca do Stage atual sozinho.
/// </summary>
public record FunnelReportDto(
    ReportPeriodDto Period,
    IReadOnlyList<FunnelStepDto> Funnel,
    int CohortSize,
    int LostCount,
    decimal? CohortConversionRate,
    decimal? PreviousCohortConversionRate,
    IReadOnlyList<DealsByStageDto> DealsByStage,
    IReadOnlyList<StageConversionDto> StageConversions,
    GoldenMetricDto GoldenMetric,
    TimeToCloseDto TimeToClose);
