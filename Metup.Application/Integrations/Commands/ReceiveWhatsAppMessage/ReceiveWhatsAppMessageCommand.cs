using Metup.Application.Conversations.Common;
using Metup.Application.Integrations.Common;
using MediatR;

namespace Metup.Application.Integrations.Commands.ReceiveWhatsAppMessage;

/// <remarks>Sem OrganizationId: o escopo vem do service token do n8n, nunca do payload.</remarks>
public record ReceiveWhatsAppMessageCommand(
    string FromWhatsApp,
    string Body,
    string? ExternalMessageId,
    DateTime? OccurredAt,
    string? ExternalConversationId = null,
    IReadOnlyList<InboundAttachmentInput>? Attachments = null) : IRequest<MessageDto>;
