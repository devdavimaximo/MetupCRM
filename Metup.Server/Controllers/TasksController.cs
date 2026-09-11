using Metup.Application.Common.Models;
using Metup.Application.Tasks.Commands.CancelTask;
using Metup.Application.Tasks.Commands.CompleteTask;
using Metup.Application.Tasks.Commands.RescheduleTask;
using Metup.Application.Tasks.Common;
using Metup.Application.Tasks.Queries.ListTasks;
using Metup.Domain.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>
/// Regra de acesso atual: sem ownerUserId informado, a listagem é sempre "minhas tarefas"
/// (o usuário logado). Pedir tarefas de outra pessoa só é permitido para Admin/Closer —
/// o handler (ListTasksQueryHandler) rejeita a tentativa de um SDR.
/// </remarks>
[ApiController]
[Authorize]
[Route("api/tasks")]
public class TasksController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<TaskDto>>> List(
        [FromQuery] Guid? ownerUserId,
        [FromQuery] TaskItemStatus? status,
        [FromQuery] DateTime? dueFrom,
        [FromQuery] DateTime? dueTo,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var query = new ListTasksQuery(ownerUserId, status, dueFrom, dueTo, page, pageSize);
        return Ok(await sender.Send(query, cancellationToken));
    }

    [HttpPost("{id:guid}/complete")]
    public async Task<ActionResult<TaskDto>> Complete(Guid id, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new CompleteTaskCommand(id), cancellationToken));

    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<TaskDto>> Cancel(Guid id, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new CancelTaskCommand(id), cancellationToken));

    [HttpPost("{id:guid}/reschedule")]
    public async Task<ActionResult<TaskDto>> Reschedule(
        Guid id,
        RescheduleTaskRequest request,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(new RescheduleTaskCommand(id, request.DueDate), cancellationToken));
}

public record RescheduleTaskRequest(DateTime DueDate);
