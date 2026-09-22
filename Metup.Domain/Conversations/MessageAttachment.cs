using Metup.Domain.Common;

namespace Metup.Domain.Conversations;

/// <summary>
/// Anexo de uma mensagem — o CRM nunca hospeda o arquivo (fronteira do CLAUDE.md, seção 5): a
/// ingestão só grava a URL e os metadados que o provedor (WhatsApp/Chatwoot, via n8n) já entrega.
/// Só existe hoje para mensagens recebidas por inbound/automação — o composer do SDR não envia
/// anexo nesta fase (decisão do plano, sem destino de upload definido).
/// </summary>
public class MessageAttachment : BaseEntity
{
    public Guid MessageId { get; init; }

    public MessageAttachmentKind Kind { get; init; }

    public string Url { get; init; } = string.Empty;

    public string? FileName { get; init; }

    public string? MimeType { get; init; }

    public long? SizeBytes { get; init; }
}
