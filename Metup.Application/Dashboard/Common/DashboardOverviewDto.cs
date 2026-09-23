using Metup.Application.Activities.Common;
using Metup.Application.Common.Models;
using Metup.Domain.Activities;
using Metup.Domain.Deals;

namespace Metup.Application.Dashboard.Common;

/// <summary>
/// Receita ganha e fechamentos (ganhos/perdidos) num intervalo da série. <c>BucketStart</c> é a
/// data <b>local</b> da organização — o front desenha o rótulo como veio, sem reconverter fuso.
/// </summary>
public record RevenuePointDto(DateOnly BucketStart, decimal Revenue, int WonDeals, int LostDeals);

/// <summary>
/// Pipeline aberto num estágio: volume, dinheiro e quantos negócios estão parados — sem mudança de
/// estágio há mais de <see cref="DashboardOverviewDto.StalledAfterDays"/> dias (via StageChange; o limite
/// vem de <c>Organization.StalledDealDays</c>).
/// <c>Amount</c> usa o valor efetivo (valor em negociação ou, na falta dele, o ticket estimado);
/// <c>EstimatedCount</c> diz quantos desses negócios entraram com o ticket.
/// </summary>
public record PipelineStageDto(DealStage Stage, int Count, decimal Amount, int EstimatedCount, int StalledCount);

/// <summary>
/// Conversão histórica de uma etapa: dos negócios que entraram nela, quantos seguiram para uma
/// etapa posterior ou para Ganho, e quanto tempo ficaram ali. <c>null</c> quando não há amostra.
/// </summary>
public record StageAdvanceRateDto(
    DealStage Stage,
    int EnteredCount,
    int AdvancedCount,
    decimal? AdvanceRate,
    double? AverageDaysInStage);

/// <summary>
/// Negócio aberto de maior valor, com a próxima ação pendente (quando houver).
/// <c>IsEstimated</c> marca o valor que veio do ticket, não do valor em negociação.
/// </summary>
public record FeaturedDealDto(
    Guid Id,
    Guid CompanyId,
    string CompanyName,
    DealStage Stage,
    decimal? Amount,
    bool IsEstimated,
    string OwnerUserName,
    int DaysInStage,
    DateTime? NextTaskDueDate,
    ActivityType? NextTaskType,
    DateOnly? ExpectedCloseDate);

/// <summary>
/// Previsão de fechamento dos negócios abertos, pela data que o responsável informou.
/// A janela vai de hoje (<c>WindowStartLocal</c>) até <c>WindowEndLocal</c>, inclusive, com a mesma
/// duração do período do dashboard, mas para a frente. <c>ExpectedToCloseAmount</c> soma o valor
/// efetivo. <c>OverdueExpectedCount</c> conta os abertos com previsão antes de hoje.
/// <c>OpenDealsWithExpectedCloseDate</c> = 0 significa que ninguém preencheu previsão ainda: a UI
/// convida a preencher em vez de mostrar R$ 0.
/// </summary>
public record ExpectedCloseDto(
    DateOnly WindowStartLocal,
    DateOnly WindowEndLocal,
    decimal ExpectedToCloseAmount,
    int ExpectedToCloseCount,
    int OverdueExpectedCount,
    int OpenDealsWithExpectedCloseDate);

/// <summary>Negócios que entraram no período por origem, e quantos deles já foram ganhos.</summary>
public record SourceBreakdownDto(DealSource Source, int NewDeals, int WonDeals, decimal Revenue);

/// <summary>Resultado de um responsável: receita ganha no período e pipeline aberto sob ele hoje.</summary>
public record OwnerPerformanceDto(
    Guid OwnerUserId,
    string OwnerUserName,
    int WonDeals,
    decimal Revenue,
    int OpenDeals,
    decimal OpenAmount);

/// <summary>
/// A central de comando comercial: dinheiro → performance → pipeline → ação, sempre com a mesma
/// janela anterior para comparação. Receita e fechamentos contam por <c>Deal.ClosedAt</c>; entrada
/// no funil por <c>Deal.CreatedAt</c>; o pipeline é a fotografia atual (não depende do período).
///
/// As janelas são recortadas em dias inteiros no fuso da organização, e <see cref="Scope"/> devolve
/// o recorte que de fato valeu — o pedido do client é resolvido no servidor, nunca aceito de olhos
/// fechados.
///
/// <c>HistoryStart</c> é o primeiro <c>Deal.CreatedAt</c> do escopo: antes dele não existe base de
/// comparação, e o front diz isso em vez de inventar percentual. <c>WeightedForecast</c> é a receita
/// prevista do pipeline aberto, ponderada pela probabilidade histórica de cada etapa — <c>null</c>
/// quando não há histórico que a sustente.
///
/// <c>PeriodStartLocal</c>/<c>PeriodEndLocal</c> são as datas locais (inclusive) do período — o front
/// rotula o intervalo com elas sem reconverter fuso.
/// </summary>
public record DashboardOverviewDto(
    int PeriodDays,
    DealScope Scope,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    DateTime PreviousStart,
    DateOnly PeriodStartLocal,
    DateOnly PeriodEndLocal,
    DateTime? HistoryStart,
    PeriodValueDto Revenue,
    PeriodValueDto WonDeals,
    PeriodValueDto LostDeals,
    PeriodValueDto NewDeals,
    PeriodValueDto ProposalsSent,
    PeriodValueDto MeetingsHeld,
    PeriodValueDto CallsMade,
    IReadOnlyList<RevenuePointDto> RevenueSeries,
    string SeriesGranularity,
    IReadOnlyList<PipelineStageDto> Pipeline,
    IReadOnlyList<StageAdvanceRateDto> StageAdvanceRates,
    decimal? WeightedForecast,
    ExpectedCloseDto ExpectedClose,
    int OpenDealsWithoutAmount,
    int StalledAfterDays,
    IReadOnlyList<FeaturedDealDto> FeaturedDeals,
    IReadOnlyList<ActivityFeedItemDto> RecentEvents,
    IReadOnlyList<SourceBreakdownDto> Sources,
    IReadOnlyList<OwnerPerformanceDto> Owners);
