using Metup.Application.LeadFinder.Commands.ChangeLeadSearch;
using Metup.Application.LeadFinder.Commands.ImportFoundLeads;
using Metup.Application.LeadFinder.Commands.RequestLeadSearch;
using Metup.Application.LeadFinder.Commands.TriageFoundLeads;
using Metup.Application.LeadFinder.Commands.UpdateLeadFinderSettings;
using Metup.Application.LeadFinder.Common;
using Metup.Application.LeadFinder.Queries.ListFoundLeads;
using Metup.Application.LeadFinder.Queries.ListLeadSearches;
using Metup.Domain.LeadFinder;
using Metup.Domain.Users;
using Metup.Server.Security;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>
/// A tela do buscador de leads: pedir buscas à automação, acompanhar e triar os resultados. O
/// garimpo em si é do n8n (ingestão em <see cref="LeadSearchIngestionController"/>).
/// </remarks>
[ApiController]
[Authorize]
[RequirePermission(Permission.LeadFinderView)]
[Route("api/lead-finder")]
public class LeadFinderController(ISender sender) : ControllerBase
{
    [HttpGet("searches")]
    public async Task<ActionResult<IReadOnlyList<LeadSearchDto>>> ListSearches(
        [FromQuery] int limit = 30,
        CancellationToken cancellationToken = default) =>
        Ok(await sender.Send(new ListLeadSearchesQuery(limit), cancellationToken));

    [HttpGet("searches/{id:guid}")]
    public async Task<ActionResult<LeadSearchDto>> GetSearch(Guid id, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetLeadSearchQuery(id), cancellationToken));

    [HttpPost("searches")]
    public async Task<ActionResult<LeadSearchDto>> RequestSearch(
        RequestLeadSearchCommand command,
        CancellationToken cancellationToken)
    {
        var search = await sender.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetSearch), new { id = search.Id }, search);
    }

    [HttpPost("searches/{id:guid}/cancel")]
    public async Task<ActionResult<LeadSearchDto>> CancelSearch(Guid id, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new ChangeLeadSearchCommand(id, LeadSearchAction.Cancel), cancellationToken));

    [HttpPost("searches/{id:guid}/retry")]
    public async Task<ActionResult<LeadSearchDto>> RetrySearch(Guid id, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new ChangeLeadSearchCommand(id, LeadSearchAction.Retry), cancellationToken));

    [HttpGet("leads")]
    public async Task<ActionResult<FoundLeadPageDto>> ListLeads(
        [FromQuery] Guid? searchId,
        [FromQuery] FoundLeadStatus status = FoundLeadStatus.New,
        [FromQuery] string? search = null,
        [FromQuery] bool? hasPhone = null,
        [FromQuery] bool? hasWebsite = null,
        [FromQuery] decimal? minRating = null,
        [FromQuery] FoundLeadSort sort = FoundLeadSort.Rating,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var query = new ListFoundLeadsQuery(searchId, status, search, hasPhone, hasWebsite, minRating, sort, page, pageSize);
        return Ok(await sender.Send(query, cancellationToken));
    }

    [HttpPost("leads/import")]
    public async Task<ActionResult<ImportFoundLeadsResult>> ImportLeads(
        ImportFoundLeadsCommand command,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(command, cancellationToken));

    [HttpPost("leads/triage")]
    public async Task<ActionResult<TriageResult>> TriageLeads(
        TriageFoundLeadsCommand command,
        CancellationToken cancellationToken) =>
        Ok(new TriageResult(await sender.Send(command, cancellationToken)));

    /// <remarks>Conexão com a automação — só quem gerencia configurações, aqui e de novo no caso de uso.</remarks>
    [HttpGet("settings")]
    [RequirePermission(Permission.SettingsManage)]
    public async Task<ActionResult<LeadFinderSettingsDto>> GetSettings(CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetLeadFinderSettingsQuery(), cancellationToken));

    [HttpPut("settings")]
    [RequirePermission(Permission.SettingsManage)]
    public async Task<ActionResult<LeadFinderSettingsDto>> UpdateSettings(
        UpdateLeadFinderSettingsCommand command,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(command, cancellationToken));
}

public record TriageResult(int Changed);
