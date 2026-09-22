using Metup.Application.Conversations.Common;
using Metup.Application.Integrations.Commands.ReceiveAutomatedOutboundMessage;
using Metup.Application.Integrations.Commands.ReceiveWhatsAppMessage;
using Metup.Application.Integrations.Common;
using Metup.Server.Security;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>
/// Ingestão n8n → CRM (seção 5 do CLAUDE.md): autenticada por service token da organização,
/// idempotente por ExternalMessageId (o n8n pode reenviar sem duplicar). O código valida tudo
/// que chega daqui — nunca confia cegamente no payload da automação.
/// </remarks>
[ApiController]
[Authorize(AuthenticationSchemes = ServiceTokenAuthenticationHandler.SchemeName)]
[Route("api/integrations/whatsapp")]
public class WhatsAppIngestionController(ISender sender) : ControllerBase
{
    [HttpPost("inbound-messages")]
    public async Task<ActionResult<MessageDto>> ReceiveInboundMessage(
        ReceiveInboundMessageRequest request,
        CancellationToken cancellationToken)
    {
        var command = new ReceiveWhatsAppMessageCommand(
            request.FromWhatsApp,
            request.Body,
            request.ExternalMessageId,
            request.OccurredAt,
            request.ExternalConversationId,
            request.Attachments);

        return Ok(await sender.Send(command, cancellationToken));
    }

    /// <summary>
    /// O n8n usa isso para REGISTRAR uma mensagem que a automação (V2, ainda não existe) já enviou
    /// de fato via WhatsApp/Chatwoot — o CRM não envia nada aqui, só documenta na timeline (item 8
    /// do plano C1 de Conversas). Sem V2 rodando, este endpoint fica pronto e sem uso.
    /// </summary>
    [HttpPost("automated-outbound-messages")]
    public async Task<ActionResult<MessageDto>> ReceiveAutomatedOutboundMessage(
        ReceiveAutomatedOutboundMessageRequest request,
        CancellationToken cancellationToken)
    {
        var command = new ReceiveAutomatedOutboundMessageCommand(
            request.ToWhatsApp,
            request.Body,
            request.ExternalMessageId,
            request.OccurredAt,
            request.Attachments);

        return Ok(await sender.Send(command, cancellationToken));
    }
}

public record ReceiveInboundMessageRequest(
    string FromWhatsApp,
    string Body,
    string? ExternalMessageId,
    DateTime? OccurredAt,
    string? ExternalConversationId = null,
    IReadOnlyList<InboundAttachmentInput>? Attachments = null);

public record ReceiveAutomatedOutboundMessageRequest(
    string ToWhatsApp,
    string Body,
    string? ExternalMessageId,
    DateTime? OccurredAt,
    IReadOnlyList<InboundAttachmentInput>? Attachments = null);
