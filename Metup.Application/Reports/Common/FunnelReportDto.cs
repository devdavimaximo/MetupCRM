using Metup.Domain.Deals;

namespace Metup.Application.Reports.Common;

public record DealsByStageDto(DealStage Stage, int Count);

/// <summary>Transição observada de estágio a estágio, contada a partir de StageChange (não do Stage atual).</summary>
public record StageConversionDto(DealStage FromStage, DealStage ToStage, int Count);

/// <summary>Tempo médio, em dias, entre o negócio entrar num estágio e sair dele (StageChanges consecutivos do mesmo Deal).</summary>
public record StageDurationDto(DealStage Stage, double AverageDays);

/// <summary>A métrica de ouro (seção 2/7 do CLAUDE.md): quantas ligações, em média, para gerar R$ 5.000.</summary>
public record GoldenMetricDto(int CallsCount, decimal ClosedRevenue, decimal? CallsPerFiveThousand);

public record FunnelReportDto(
    IReadOnlyList<DealsByStageDto> DealsByStage,
    IReadOnlyList<StageConversionDto> StageConversions,
    IReadOnlyList<StageDurationDto> AverageDaysInStage,
    GoldenMetricDto GoldenMetric);
