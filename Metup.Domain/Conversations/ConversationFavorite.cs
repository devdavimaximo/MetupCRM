using Metup.Domain.Common;

namespace Metup.Domain.Conversations;

/// <summary>
/// Marcação pessoal por usuário — não afeta quem responde a conversa (a Inbox continua
/// compartilhada). Uma linha por par conversa×usuário; favoritar/desfavoritar é upsert/delete.
/// </summary>
public class ConversationFavorite : BaseEntity
{
    public Guid ConversationId { get; init; }

    public Guid UserId { get; init; }
}
