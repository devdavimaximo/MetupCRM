using Metup.Application.Deals.Common;
using Metup.Application.Integrations.Commands.ReceiveMetaAdsLead;
using Metup.Server.Security;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

[ApiController]
[Authorize(AuthenticationSchemes = ServiceTokenAuthenticationHandler.SchemeName)]
[Route("api/integrations/meta-ads")]
public class MetaAdsIngestionController(ISender sender) : ControllerBase
{
    [HttpPost("leads")]
    public async Task<ActionResult<DealDto>> ReceiveLead(
        ReceiveMetaAdsLeadRequest request,
        CancellationToken cancellationToken)
    {
        var command = new ReceiveMetaAdsLeadCommand(
            request.ExternalLeadId,
            request.CompanyName,
            request.ContactName,
            request.Phone,
            request.Email,
            request.OwnerUserId,
            request.Ticket,
            request.Note);

        return Ok(await sender.Send(command, cancellationToken));
    }
}

public record ReceiveMetaAdsLeadRequest(
    string ExternalLeadId,
    string CompanyName,
    string ContactName,
    string? Phone,
    string? Email,
    Guid OwnerUserId,
    decimal? Ticket,
    string? Note);
