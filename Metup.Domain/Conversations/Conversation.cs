using Metup.Domain.Common;

namespace Metup.Domain.Conversations;

/// <summary>
/// Thread de WhatsApp com um Contact — sempre 1:1 (um número de WhatsApp é uma conversa
/// contínua, igual o próprio WhatsApp funciona). Nasce da primeira mensagem inbound entregue
/// pelo n8n; o dado e a inbox são do código, a entrega de fato é do n8n (seção 5 do CLAUDE.md).
/// </summary>
public class Conversation : BaseEntity
{
    public Guid ContactId { get; set; }

    public DateTime? LastMessageAt { get; set; }

    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

    public static Conversation Create(Guid organizationId, Guid contactId) =>
        new()
        {
            OrganizationId = organizationId,
            ContactId = contactId,
        };
}
