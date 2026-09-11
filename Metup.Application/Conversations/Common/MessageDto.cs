using Metup.Domain.Conversations;
using Metup.Domain.Deals;

namespace Metup.Application.Conversations.Common;

public record MessageDto(
    Guid Id,
    Guid ConversationId,
    MessageDirection Direction,
    string Body,
    Guid? AuthorUserId,
    string? AuthorUserName,
    Guid? DealId,
    DealStage? DealStageAtMessage,
    DateTime OccurredAt);
