namespace Metup.Domain.Conversations;

/// <summary>
/// Status operacional da conversa (mesmo vocabulário do Chatwoot: open/pending/resolved). Nasce
/// <see cref="Aberta"/> na primeira mensagem inbound; mensagem inbound nova reabre uma conversa
/// <see cref="Resolvida"/> automaticamente (regra de domínio em <c>Conversation.Reopen</c>).
/// </summary>
public enum ConversationStatus
{
    Aberta,
    Pendente,
    Resolvida,
}
