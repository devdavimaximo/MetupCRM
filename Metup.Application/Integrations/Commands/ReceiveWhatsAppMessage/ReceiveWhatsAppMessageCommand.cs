using Metup.Application.Conversations.Common;
using MediatR;

namespace Metup.Application.Integrations.Commands.ReceiveWhatsAppMessage;

/// <remarks>Sem OrganizationId: o escopo vem do service token do n8n, nunca do payload.</remarks>
public record ReceiveWhatsAppMessageCommand(
    string FromWhatsApp,
    string Body,
    string? ExternalMessageId,
    DateTime? OccurredAt) : IRequest<MessageDto>;
