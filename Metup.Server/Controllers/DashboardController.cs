using Metup.Application.Common.Models;
using Metup.Application.Dashboard.Common;
using Metup.Application.Dashboard.Queries.GetDashboardOverview;
using Metup.Application.Dashboard.Queries.GetDashboardSummary;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Metup.Domain.Users;
using Metup.Server.Security;

namespace Metup.Server.Controllers;

[ApiController]
[Authorize]
[RequirePermission(Permission.DashboardView)]
[Route("api/dashboard")]
public class DashboardController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<DashboardSummaryDto>> Get(CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetDashboardSummaryQuery(), cancellationToken));

    /// <summary>
    /// O escopo é um pedido: quem decide o que este usuário enxerga é o caso de uso
    /// (<c>ResolveDealScope</c>). O escopo aplicado volta no próprio DTO. <c>from</c>/<c>to</c> são
    /// datas locais da organização (yyyy-MM-dd, inclusive) e têm precedência sobre <c>days</c>.
    /// </summary>
    [HttpGet("overview")]
    public async Task<ActionResult<DashboardOverviewDto>> GetOverview(
        [FromQuery] int days = 30,
        [FromQuery] DealScope scope = DealScope.Organization,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
        CancellationToken cancellationToken = default) =>
        Ok(await sender.Send(new GetDashboardOverviewQuery(days, scope, from, to), cancellationToken));
}
