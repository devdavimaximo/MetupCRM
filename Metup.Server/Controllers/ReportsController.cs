using Metup.Application.Reports.Common;
using Metup.Application.Reports.Queries.GetCohortReport;
using Metup.Application.Reports.Queries.GetForecastReport;
using Metup.Application.Reports.Queries.GetFunnelReport;
using Metup.Application.Reports.Queries.GetSalesPerformanceByOwner;
using Metup.Application.Reports.Queries.GetSalesPerformanceBySegment;
using Metup.Application.Reports.Queries.GetSalesPerformanceBySource;
using Metup.Application.Reports.Queries.GetTimeToCloseReport;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <summary>
/// Relatórios (V3, seção 7 do CLAUDE.md). Todos aceitam o mesmo período: <c>?days=</c> (últimos N
/// dias terminando hoje) ou <c>?from=&amp;to=</c> em datas locais da organização, que têm
/// precedência — o mesmo contrato do dashboard. Quem resolve a janela é o servidor, e ela volta em
/// <c>period</c> junto com a janela anterior usada para comparar.
/// </summary>
[ApiController]
[Authorize]
[Route("api/reports")]
public class ReportsController(ISender sender) : ControllerBase
{
    [HttpGet("funnel")]
    public async Task<ActionResult<FunnelReportDto>> GetFunnel(
        [FromQuery] int days = IReportPeriodRequest.DefaultDays,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
        CancellationToken cancellationToken = default) =>
        Ok(await sender.Send(new GetFunnelReportQuery(days, from, to), cancellationToken));

    [HttpGet("sales-by-owner")]
    public async Task<ActionResult<SalesPerformanceReportDto>> GetSalesByOwner(
        [FromQuery] int days = IReportPeriodRequest.DefaultDays,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
        CancellationToken cancellationToken = default) =>
        Ok(await sender.Send(new GetSalesPerformanceByOwnerQuery(days, from, to), cancellationToken));

    [HttpGet("sales-by-segment")]
    public async Task<ActionResult<SalesPerformanceReportDto>> GetSalesBySegment(
        [FromQuery] int days = IReportPeriodRequest.DefaultDays,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
        CancellationToken cancellationToken = default) =>
        Ok(await sender.Send(new GetSalesPerformanceBySegmentQuery(days, from, to), cancellationToken));

    [HttpGet("sales-by-source")]
    public async Task<ActionResult<SalesPerformanceReportDto>> GetSalesBySource(
        [FromQuery] int days = IReportPeriodRequest.DefaultDays,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
        CancellationToken cancellationToken = default) =>
        Ok(await sender.Send(new GetSalesPerformanceBySourceQuery(days, from, to), cancellationToken));

    /// <summary>
    /// O mesmo tempo até fechamento que o relatório de funil já traz embutido, isolado para quem
    /// consome a API sem a tela.
    /// </summary>
    [HttpGet("time-to-close")]
    public async Task<ActionResult<TimeToCloseReportDto>> GetTimeToClose(
        [FromQuery] int days = IReportPeriodRequest.DefaultDays,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
        CancellationToken cancellationToken = default) =>
        Ok(await sender.Send(new GetTimeToCloseReportQuery(days, from, to), cancellationToken));

    [HttpGet("cohorts")]
    public async Task<ActionResult<CohortReportDto>> GetCohorts(
        [FromQuery] int days = IReportPeriodRequest.DefaultDays,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
        CancellationToken cancellationToken = default) =>
        Ok(await sender.Send(new GetCohortReportQuery(days, from, to), cancellationToken));

    [HttpGet("forecast")]
    public async Task<ActionResult<ForecastReportDto>> GetForecast(
        [FromQuery] int days = IReportPeriodRequest.DefaultDays,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
        CancellationToken cancellationToken = default) =>
        Ok(await sender.Send(new GetForecastReportQuery(days, from, to), cancellationToken));
}
