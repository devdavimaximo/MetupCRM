using Metup.Application.Dashboard.Common;
using Metup.Application.Dashboard.Queries.GetDashboardSummary;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/dashboard")]
public class DashboardController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<DashboardSummaryDto>> Get(CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetDashboardSummaryQuery(), cancellationToken));
}
