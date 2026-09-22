namespace Metup.Domain.Conversations;

/// <summary>
/// Canal da conversa — hoje só <see cref="WhatsApp"/>; cresce quando o sócio ligar novos canais no
/// Chatwoot (regra 4.4 do CLAUDE.md, multi-origem pronto desde já). Persistido como texto: valores
/// existentes nunca são renomeados, novos entram no fim.
/// </summary>
public enum ConversationChannel
{
    WhatsApp,
}
