using Metup.Domain.Activities;
using Metup.Domain.Tasks;

namespace Metup.Application.Tasks.Common;

/// <summary>Uma tarefa (próxima ação) sobre um negócio — o que alimenta o "hoje" do SDR.</summary>
public record TaskDto(
    Guid Id,
    Guid DealId,
    Guid CompanyId,
    string CompanyName,
    ActivityType Type,
    DateTime DueDate,
    Guid OwnerUserId,
    string OwnerUserName,
    string? Note,
    TaskItemStatus Status,
    DateTime CreatedAt,
    DateTime? CompletedAt);
