namespace Metup.Domain.Conversations;

/// <summary>
/// Quem escreveu uma mensagem outbound — só existe para outbound (inbound é o contato, sem
/// ambiguidade). <see cref="Bot"/> é a automação (n8n) registrando algo que já enviou de fato; a UI
/// rotula como "Assistente Metup", nunca com nome de usuário.
/// </summary>
public enum MessageAuthorKind
{
    Sdr,
    Bot,
}
