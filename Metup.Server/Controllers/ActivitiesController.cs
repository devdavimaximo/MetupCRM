using Metup.Application.Activities.Commands.LogActivity;
using Metup.Application.Activities.Common;
using Metup.Application.Activities.Queries.ListActivitiesByDeal;
using Metup.Domain.Activities;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>
/// Atividades vivem dentro de um negócio — a timeline é sempre lida/escrita pelo DealId da rota,
/// nunca por um id de atividade solto (não há tela de edição de atividade na V1).
/// </remarks>
[ApiController]
[Authorize]
[Route("api/deals/{dealId:guid}/activities")]
public class ActivitiesController(ISender sender) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<LogActivityResultDto>> Log(
        Guid dealId,
        LogActivityRequest request,
        CancellationToken cancellationToken)
    {
        var command = new LogActivityCommand(
            dealId,
            request.ContactId,
            request.Type,
            request.Outcome,
            request.Note,
            request.OccurredAt,
            request.NextActionType,
            request.NextActionDueDate,
            request.NextActionNote,
            request.CompletesTaskId);

        return Ok(await sender.Send(command, cancellationToken));
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ActivityDto>>> ListByDeal(
        Guid dealId,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(new ListActivitiesByDealQuery(dealId), cancellationToken));
}

public record LogActivityRequest(
    Guid? ContactId,
    ActivityType Type,
    ActivityOutcome? Outcome,
    string? Note,
    DateTime? OccurredAt,
    ActivityType? NextActionType,
    DateTime? NextActionDueDate,
    string? NextActionNote,
    Guid? CompletesTaskId = null);
