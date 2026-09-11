using Metup.Domain.Common;

namespace Metup.Domain.Integrations;

/// <summary>
/// Fila de eventos de saída para o n8n consumir (seção 6 do CLAUDE.md) — o CRM funciona sem o
/// n8n porque só grava aqui; o n8n é quem consulta os pendentes e confirma (ack) a entrega.
/// Isso mantém a fronteira do código↔n8n sagrada (seção 5): o código nunca fala com a API do
/// WhatsApp/Meta diretamente, só enfileira a intenção.
/// </summary>
public class IntegrationEvent : BaseEntity
{
    public string Type { get; private set; } = string.Empty;

    /// <summary>Payload já serializado em JSON — a Domain não depende de biblioteca de serialização.</summary>
    public string Payload { get; private set; } = string.Empty;

    public IntegrationEventStatus Status { get; private set; } = IntegrationEventStatus.Pending;

    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

    public DateTime? DeliveredAt { get; private set; }

    public static IntegrationEvent Create(Guid organizationId, string type, string payload) =>
        new()
        {
            OrganizationId = organizationId,
            Type = type,
            Payload = payload,
        };

    public void MarkDelivered(DateTime nowUtc)
    {
        if (Status == IntegrationEventStatus.Delivered)
        {
            return;
        }

        Status = IntegrationEventStatus.Delivered;
        DeliveredAt = nowUtc;
    }
}
