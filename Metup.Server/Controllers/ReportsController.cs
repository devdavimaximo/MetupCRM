using Metup.Application.Reports.Common;
using Metup.Application.Reports.Queries.GetFunnelReport;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/reports")]
public class ReportsController(ISender sender) : ControllerBase
{
    [HttpGet("funnel")]
    public async Task<ActionResult<FunnelReportDto>> GetFunnel(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetFunnelReportQuery(from, to), cancellationToken));
}
