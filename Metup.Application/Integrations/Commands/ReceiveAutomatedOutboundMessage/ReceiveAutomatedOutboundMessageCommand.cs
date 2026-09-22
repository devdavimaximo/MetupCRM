using Metup.Application.Conversations.Common;
using Metup.Application.Integrations.Common;
using MediatR;

namespace Metup.Application.Integrations.Commands.ReceiveAutomatedOutboundMessage;

/// <remarks>
/// Sem OrganizationId: o escopo vem do service token do n8n. O n8n usa isso para REGISTRAR uma
/// mensagem que a automação (V2, ainda não existe) já enviou de fato pelo WhatsApp/Chatwoot — o
/// CRM não envia nada aqui, só documenta na timeline (item 8 do plano C1).
/// </remarks>
public record ReceiveAutomatedOutboundMessageCommand(
    string ToWhatsApp,
    string Body,
    string? ExternalMessageId,
    DateTime? OccurredAt,
    IReadOnlyList<InboundAttachmentInput>? Attachments = null) : IRequest<MessageDto>;
