using Metup.Domain.Conversations;

namespace Metup.Application.Conversations.Common;

public record ConversationListItemDto(
    Guid Id,
    Guid ContactId,
    string ContactName,
    Guid CompanyId,
    string CompanyName,
    string? LastMessagePreview,
    DateTime? LastMessageAt,
    DateTime CreatedAt,
    ConversationChannel Channel,
    ConversationStatus Status,
    bool IsUnread,
    bool IsFavorite,
    IReadOnlyList<string> Tags);
