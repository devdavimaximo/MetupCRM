using Metup.Application.Conversations.Common;
using Metup.Application.Integrations.Commands.ReceiveWhatsAppMessage;
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
            request.OccurredAt);

        return Ok(await sender.Send(command, cancellationToken));
    }
}

public record ReceiveInboundMessageRequest(
    string FromWhatsApp,
    string Body,
    string? ExternalMessageId,
    DateTime? OccurredAt);
