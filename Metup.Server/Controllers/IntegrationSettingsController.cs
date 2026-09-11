using Metup.Application.Integrations.Commands.RotateIntegrationToken;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>
/// Emissão do service token que o sócio configura no n8n (seção 5/10 do CLAUDE.md — segredo de
/// integração fica no n8n, o CRM só emite e guarda o hash). Só Admin.
/// </remarks>
[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/integrations/service-token")]
public class IntegrationSettingsController(ISender sender) : ControllerBase
{
    [HttpPost("rotate")]
    public async Task<ActionResult<RotateIntegrationTokenResult>> Rotate(CancellationToken cancellationToken) =>
        Ok(await sender.Send(new RotateIntegrationTokenCommand(), cancellationToken));
}
