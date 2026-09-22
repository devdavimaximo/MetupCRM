using Metup.Domain.Common;

namespace Metup.Domain.Conversations;

/// <summary>Junção conversa×tag aplicada — o catálogo em si é <see cref="ConversationTagOption"/>.</summary>
public class ConversationTag : BaseEntity
{
    public Guid ConversationId { get; init; }

    public Guid TagOptionId { get; init; }
}
