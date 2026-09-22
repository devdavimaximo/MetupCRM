using Metup.Domain.Conversations;

namespace Metup.Application.Integrations.Common;

/// <summary>Anexo recebido do n8n na ingestão — o CRM só grava a URL e os metadados, nunca hospeda o arquivo.</summary>
public record InboundAttachmentInput(
    MessageAttachmentKind Kind,
    string Url,
    string? FileName,
    string? MimeType,
    long? SizeBytes);
