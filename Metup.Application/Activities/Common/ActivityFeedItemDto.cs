using Metup.Domain.Activities;
using Metup.Domain.Deals;

namespace Metup.Application.Activities.Common;

/// <summary>O que aconteceu: uma transição de estágio (nascimento, avanço, ganho, perda) ou uma atividade.</summary>
public enum ActivityFeedKind
{
    DealCreated,
    StageAdvanced,
    DealWon,
    DealLost,
    Activity,
}

/// <summary>
/// Filtro do feed. As quatro primeiras opções são tipos de transição de estágio; as demais são
/// atividades do <see cref="ActivityType"/> de mesmo nome.
/// </summary>
public enum ActivityFeedFilter
{
    DealCreated,
    StageAdvanced,
    DealWon,
    DealLost,
    Call,
    WhatsApp,
    Meeting,
    Proposal,
    Note,
}

/// <summary>
/// Uma linha do feed da operação. <c>Id</c> é o id da atividade ou da transição de estágio, estável
/// entre páginas. <c>OccurredOnLocal</c> é o dia de <c>OccurredAt</c> no fuso da organização — o front
/// agrupa por ele, sem converter fuso no navegador. <c>Amount</c> só vem no ganho (valor fechado do negócio).
/// </summary>
public record ActivityFeedItemDto(
    Guid Id,
    ActivityFeedKind Kind,
    Guid DealId,
    string CompanyName,
    string ActorName,
    DateTime OccurredAt,
    DateOnly OccurredOnLocal,
    DealStage? ToStage,
    ActivityType? ActivityType,
    ActivityOutcome? Outcome,
    decimal? Amount);

/// <summary><c>NextCursor</c> nulo = fim do feed.</summary>
public record ActivityFeedPageDto(IReadOnlyList<ActivityFeedItemDto> Items, string? NextCursor);
