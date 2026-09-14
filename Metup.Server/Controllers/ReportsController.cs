using Metup.Application.Reports.Common;
using Metup.Application.Reports.Queries.GetCohortReport;
using Metup.Application.Reports.Queries.GetFunnelReport;
using Metup.Application.Reports.Queries.GetSalesPerformanceByOwner;
using Metup.Application.Reports.Queries.GetSalesPerformanceBySegment;
using Metup.Application.Reports.Queries.GetSalesPerformanceBySource;
using Metup.Application.Reports.Queries.GetTimeToCloseReport;
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

    [HttpGet("sales-by-owner")]
    public async Task<ActionResult<SalesPerformanceReportDto>> GetSalesByOwner(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetSalesPerformanceByOwnerQuery(from, to), cancellationToken));

    [HttpGet("sales-by-segment")]
    public async Task<ActionResult<SalesPerformanceReportDto>> GetSalesBySegment(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetSalesPerformanceBySegmentQuery(from, to), cancellationToken));

    [HttpGet("sales-by-source")]
    public async Task<ActionResult<SalesPerformanceReportDto>> GetSalesBySource(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetSalesPerformanceBySourceQuery(from, to), cancellationToken));

    [HttpGet("time-to-close")]
    public async Task<ActionResult<TimeToCloseReportDto>> GetTimeToClose(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetTimeToCloseReportQuery(from, to), cancellationToken));

    [HttpGet("cohorts")]
    public async Task<ActionResult<CohortReportDto>> GetCohorts(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetCohortReportQuery(from, to), cancellationToken));
}
