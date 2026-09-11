using Metup.Application.Integrations.Commands.AckIntegrationEvent;
using Metup.Application.Integrations.Common;
using Metup.Application.Integrations.Queries.ListPendingIntegrationEvents;
using Metup.Server.Security;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>
/// Fila de eventos de saída (seção 6 do CLAUDE.md): o n8n consulta os pendentes e confirma
/// (ack) a entrega. O CRM funciona sem o n8n porque só grava aqui — quem entrega de fato é ele.
/// </remarks>
[ApiController]
[Authorize(AuthenticationSchemes = ServiceTokenAuthenticationHandler.SchemeName)]
[Route("api/integrations/events")]
public class IntegrationEventsController(ISender sender) : ControllerBase
{
    [HttpGet("pending")]
    public async Task<ActionResult<IReadOnlyList<IntegrationEventDto>>> ListPending(
        [FromQuery] int limit = 50,
        CancellationToken cancellationToken = default) =>
        Ok(await sender.Send(new ListPendingIntegrationEventsQuery(limit), cancellationToken));

    [HttpPost("{id:guid}/ack")]
    public async Task<IActionResult> Ack(Guid id, CancellationToken cancellationToken)
    {
        await sender.Send(new AckIntegrationEventCommand(id), cancellationToken);
        return NoContent();
    }
}
