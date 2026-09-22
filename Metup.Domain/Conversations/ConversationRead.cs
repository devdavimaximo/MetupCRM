using Metup.Domain.Common;

namespace Metup.Domain.Conversations;

/// <summary>
/// Cursor de leitura por usuário — a Inbox é compartilhada pela organização inteira (sem
/// responsável/assignee), então "não lida" não pode ser um booleano único na conversa: cada SDR
/// tem seu próprio ponto de leitura. Uma linha por par conversa×usuário, upsert ao abrir a conversa
/// ou marcar como lida/não lida manualmente.
/// </summary>
public class ConversationRead : BaseEntity
{
    public Guid ConversationId { get; init; }

    public Guid UserId { get; init; }

    public DateTime LastReadAt { get; set; }
}
