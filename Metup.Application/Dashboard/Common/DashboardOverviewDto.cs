using Metup.Domain.Activities;
using Metup.Domain.Deals;

namespace Metup.Application.Dashboard.Common;

/// <summary>Um número do período e o mesmo número na janela imediatamente anterior, de mesmo tamanho.</summary>
public record PeriodValueDto(decimal Current, decimal Previous);

/// <summary>Receita ganha e fechamentos (ganhos/perdidos) num intervalo da série (dia ou semana, conforme o período).</summary>
public record RevenuePointDto(DateTime BucketStart, decimal Revenue, int WonDeals, int LostDeals);

/// <summary>
/// Pipeline aberto num estágio: volume, dinheiro e quantos negócios estão parados — sem mudança de
/// estágio há mais de <see cref="DashboardOverviewDto.StalledAfterDays"/> dias (via StageChange).
/// </summary>
public record PipelineStageDto(DealStage Stage, int Count, decimal Amount, int StalledCount);

/// <summary>Negócio aberto de maior valor, com a próxima ação pendente (quando houver).</summary>
public record FeaturedDealDto(
    Guid Id,
    string CompanyName,
    DealStage Stage,
    decimal? Amount,
    string OwnerUserName,
    int DaysInStage,
    DateTime? NextTaskDueDate,
    ActivityType? NextTaskType);

public enum RecentEventKind
{
    DealCreated,
    StageAdvanced,
    DealWon,
    DealLost,
    Activity,
}

/// <summary>Uma linha do feed da operação — atividade registrada ou transição de estágio.</summary>
public record RecentEventDto(
    RecentEventKind Kind,
    Guid DealId,
    string CompanyName,
    string ActorName,
    DateTime OccurredAt,
    DealStage? ToStage,
    ActivityType? ActivityType,
    ActivityOutcome? Outcome,
    decimal? Amount);

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
/// </summary>
public record DashboardOverviewDto(
    int PeriodDays,
    DateTime PeriodStart,
    DateTime PeriodEnd,
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
    int OpenDealsWithoutAmount,
    int StalledAfterDays,
    IReadOnlyList<FeaturedDealDto> FeaturedDeals,
    IReadOnlyList<RecentEventDto> RecentEvents,
    IReadOnlyList<SourceBreakdownDto> Sources,
    IReadOnlyList<OwnerPerformanceDto> Owners);
