using Metup.Domain.Common;
using Metup.Domain.Common.Exceptions;
using Metup.Domain.Deals;

namespace Metup.Domain.Conversations;

/// <summary>
/// Uma mensagem de WhatsApp dentro de uma Conversation. O código só registra e exibe — quem
/// fala com a API do WhatsApp de fato (enviar/receber) é o n8n (regra 4.5/5 do CLAUDE.md).
/// <see cref="DealStageAtMessage"/> é o estágio do negócio do contato no momento da mensagem —
/// um snapshot histórico, não uma referência viva (o negócio pode mudar de estágio depois).
/// </summary>
public class Message : BaseEntity
{
    public Guid ConversationId { get; set; }

    public MessageDirection Direction { get; private set; }

    public string Body { get; private set; } = string.Empty;

    /// <summary>Id da mensagem no provedor de WhatsApp — usado pelo n8n para dedupe idempotente.</summary>
    public string? ExternalMessageId { get; set; }

    /// <summary>Preenchido só em mensagens outbound: o SDR que respondeu pela inbox.</summary>
    public Guid? AuthorUserId { get; set; }

    /// <summary>Só existe para outbound — distingue o SDR humano da automação (Bot). Null em inbound.</summary>
    public MessageAuthorKind? AuthorKind { get; private set; }

    public Guid? DealId { get; set; }

    public DealStage? DealStageAtMessage { get; set; }

    public DateTime OccurredAt { get; set; }

    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

    public ICollection<MessageAttachment> Attachments { get; init; } = [];

    public static Message ReceiveInbound(
        Guid organizationId,
        Guid conversationId,
        string body,
        string? externalMessageId,
        Guid? dealId,
        DealStage? dealStageAtMessage,
        DateTime occurredAt) =>
        Create(organizationId, conversationId, MessageDirection.Inbound, body, externalMessageId, null, null, dealId, dealStageAtMessage, occurredAt);

    public static Message SendOutbound(
        Guid organizationId,
        Guid conversationId,
        string body,
        Guid authorUserId,
        Guid? dealId,
        DealStage? dealStageAtMessage,
        DateTime occurredAt) =>
        Create(organizationId, conversationId, MessageDirection.Outbound, body, null, authorUserId, MessageAuthorKind.Sdr, dealId, dealStageAtMessage, occurredAt);

    /// <summary>
    /// O n8n registra (não envia) uma mensagem que a automação já entregou de fato via WhatsApp —
    /// a UI rotula como "Assistente Metup", nunca com nome de usuário (item 8 do plano C1).
    /// </summary>
    public static Message ReceiveAutomatedOutbound(
        Guid organizationId,
        Guid conversationId,
        string body,
        string? externalMessageId,
        Guid? dealId,
        DealStage? dealStageAtMessage,
        DateTime occurredAt) =>
        Create(organizationId, conversationId, MessageDirection.Outbound, body, externalMessageId, null, MessageAuthorKind.Bot, dealId, dealStageAtMessage, occurredAt);

    private static Message Create(
        Guid organizationId,
        Guid conversationId,
        MessageDirection direction,
        string body,
        string? externalMessageId,
        Guid? authorUserId,
        MessageAuthorKind? authorKind,
        Guid? dealId,
        DealStage? dealStageAtMessage,
        DateTime occurredAt)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            throw new DomainRuleException("Toda mensagem precisa de um texto.");
        }

        return new Message
        {
            OrganizationId = organizationId,
            ConversationId = conversationId,
            Direction = direction,
            Body = body.Trim(),
            ExternalMessageId = externalMessageId,
            AuthorUserId = authorUserId,
            AuthorKind = authorKind,
            DealId = dealId,
            DealStageAtMessage = dealStageAtMessage,
            OccurredAt = occurredAt,
        };
    }
}
