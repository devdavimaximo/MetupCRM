using Metup.Domain.Activities;

namespace Metup.Application.Activities.Common;

/// <summary>Uma linha da timeline do negócio — tipo, desfecho, autor e quando aconteceu.</summary>
public record ActivityDto(
    Guid Id,
    Guid DealId,
    Guid? ContactId,
    string? ContactName,
    ActivityType Type,
    ActivityOutcome? Outcome,
    string? Note,
    Guid AuthorUserId,
    string AuthorUserName,
    DateTime OccurredAt,
    DateTime CreatedAt);
