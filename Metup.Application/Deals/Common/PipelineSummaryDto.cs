using Metup.Domain.Deals;

namespace Metup.Application.Deals.Common;

/// <summary>
/// Os cinco números do cabeçalho do pipeline.
/// <list type="bullet">
/// <item><c>PipelineTotal</c>/<c>OpenDeals</c>: abertos no fim da janela (valor efetivo vigente).</item>
/// <item><c>ForecastRevenue</c>: o pipeline ponderado pela probabilidade histórica de cada etapa — a
/// "receita prevista" do dashboard; <c>null</c> sem histórico de fechamento.</item>
/// <item><c>ConversionRate</c>: conversão em coorte (0–1), igual a <c>FunnelSummary.Pct</c>.</item>
/// <item><c>AverageTicket</c>: receita ganha ÷ ganhos com <c>ClosedAt</c> na janela.</item>
/// </list>
/// </summary>
public record PipelineKpisDto(
    decimal PipelineTotal,
    decimal? ForecastRevenue,
    int OpenDeals,
    decimal? ConversionRate,
    decimal? AverageTicket);

/// <summary>Uma etapa do funil em coorte: quantos alcançaram (ou passaram), o valor deles e a fração do topo (0–1).</summary>
public record PipelineFunnelStageDto(DealStage Stage, int Reached, decimal Value, decimal? PctOfTop);

/// <summary>"Do total de <c>Top</c> negócios criados no período, <c>Pct</c> se tornaram clientes."</summary>
public record PipelineFunnelSummaryDto(int Top, int Won, decimal? Pct);

/// <summary>
/// Uma série por KPI, alinhadas por índice com <c>BucketStarts</c> (datas locais). Um ponto por dia
/// até 31 dias de período, por semana acima disso. Cada ponto é o KPI no fim do intervalo:
/// fotografia para pipeline, previsão e abertos; acumulado desde o início do período para conversão
/// e ticket médio. O último ponto é o próprio KPI.
/// </summary>
public record PipelineSparklinesDto(
    string Granularity,
    IReadOnlyList<DateOnly> BucketStarts,
    IReadOnlyList<decimal> PipelineTotal,
    IReadOnlyList<decimal?> ForecastRevenue,
    IReadOnlyList<int> OpenDeals,
    IReadOnlyList<decimal?> ConversionRate,
    IReadOnlyList<decimal?> AverageTicket);

/// <summary>
/// Resumo do pipeline para o período. <c>SnapshotAt</c> é o instante das fotografias (fim do período,
/// ou agora se o período termina hoje). <c>Previous</c> é a janela anterior de mesmo tamanho, com as
/// fotografias no fim dela; <c>null</c> quando nenhum negócio do escopo existia antes do período
/// ("Sem base anterior"). O funil é a coorte dos negócios criados no período.
/// </summary>
public record PipelineSummaryDto(
    Guid? OwnerUserId,
    DateOnly PeriodStartLocal,
    DateOnly PeriodEndLocal,
    DateTime SnapshotAt,
    PipelineKpisDto Kpis,
    PipelineKpisDto? Previous,
    PipelineSparklinesDto Sparklines,
    IReadOnlyList<PipelineFunnelStageDto> Funnel,
    PipelineFunnelSummaryDto FunnelSummary);

/// <summary>
/// Um mês da evolução: o pipeline aberto no fim do mês local (<c>IsPartial</c> = mês corrente, lido
/// agora). Negócios alterados antes do histórico de valor usam o valor seguinte conhecido (aproximação).
/// </summary>
public record PipelineEvolutionPointDto(
    string Month,
    DateOnly MonthEndLocal,
    bool IsPartial,
    decimal PipelineTotal,
    decimal? ForecastRevenue,
    int OpenDeals);

public record PipelineEvolutionDto(Guid? OwnerUserId, IReadOnlyList<PipelineEvolutionPointDto> Points);
