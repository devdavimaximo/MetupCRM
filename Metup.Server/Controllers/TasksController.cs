using Metup.Application.Common.Models;
using Metup.Application.Tasks.Commands.CancelTask;
using Metup.Application.Tasks.Commands.CompleteTask;
using Metup.Application.Tasks.Commands.CreateTask;
using Metup.Application.Tasks.Commands.BulkTask;
using Metup.Application.Tasks.Commands.ReassignTask;
using Metup.Application.Tasks.Commands.RescheduleTask;
using Metup.Application.Tasks.Common;
using Metup.Application.Tasks.Queries.GetTaskCalendar;
using Metup.Application.Tasks.Queries.GetTaskSummary;
using Metup.Application.Tasks.Queries.ListTasks;
using Metup.Domain.Activities;
using Metup.Domain.Deals;
using Metup.Domain.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>
/// Regra de acesso: sem ownerUserId/allOwners, a listagem e o resumo são sempre "minhas tarefas"
/// (o usuário logado). Outro responsável ou todos só para Admin/Closer — decidido em
/// <c>ResolveTaskOwnerScope</c>, não aqui.
/// </remarks>
[ApiController]
[Authorize]
[Route("api/tasks")]
public class TasksController(ISender sender) : ControllerBase
{
    /// <remarks>
    /// Sem <c>scope</c> = modo legado (status/dueFrom/dueTo), usado pela TasksPage atual. Com
    /// <c>scope</c> = recortes da tela nova (All, Overdue, Today, ThisWeek, Later).
    /// </remarks>
    [HttpGet]
    public async Task<ActionResult<PagedResult<TaskDto>>> List(
        [FromQuery] Guid? ownerUserId,
        [FromQuery] TaskItemStatus? status,
        [FromQuery] DateTime? dueFrom,
        [FromQuery] DateTime? dueTo,
        [FromQuery] TaskScope? scope,
        [FromQuery] DateOnly? referenceDate,
        [FromQuery] TaskItemStatus[]? statuses,
        [FromQuery] ActivityType[]? types,
        [FromQuery] DealStage[]? dealStages,
        [FromQuery] string? search,
        [FromQuery] bool allOwners = false,
        [FromQuery] TaskSort sort = TaskSort.DueAsc,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var query = new ListTasksQuery(
            ownerUserId, status, dueFrom, dueTo, page, pageSize,
            scope, referenceDate, statuses, types, dealStages, search, allOwners, sort);

        return Ok(await sender.Send(query, cancellationToken));
    }

    [HttpGet("summary")]
    public async Task<ActionResult<TaskSummaryDto>> Summary(
        [FromQuery] Guid? ownerUserId,
        [FromQuery] DateOnly? referenceDate,
        [FromQuery] bool allOwners = false,
        CancellationToken cancellationToken = default) =>
        Ok(await sender.Send(new GetTaskSummaryQuery(ownerUserId, allOwners, referenceDate), cancellationToken));

    /// <summary>Tarefa avulsa criada pela tela. Não dispara evento de saída para o n8n.</summary>
    [HttpPost]
    public async Task<ActionResult<TaskDto>> Create(CreateTaskBody request, CancellationToken cancellationToken)
    {
        var command = new CreateTaskCommand(request.DealId, request.Type, request.DueDate, request.Note, request.OwnerUserId);
        var task = await sender.Send(command, cancellationToken);

        return Created($"/api/tasks/{task.Id}", task);
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

    /// <summary>Só Admin/Closer (403 para SDR); destino de outra organização = 404.</summary>
    [HttpPost("{id:guid}/reassign")]
    public async Task<ActionResult<TaskDto>> Reassign(
        Guid id,
        ReassignTaskRequest request,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(new ReassignTaskCommand(id, request.OwnerUserId), cancellationToken));

    /// <remarks>
    /// Até 100 tarefas numa transação. Falha por item (<c>NotFound</c>/<c>NotPending</c>) não derruba o
    /// lote; repetir o pedido é seguro.
    /// </remarks>
    [HttpPost("bulk")]
    public async Task<ActionResult<BulkTaskResultDto>> Bulk(BulkTaskCommand request, CancellationToken cancellationToken) =>
        Ok(await sender.Send(request, cancellationToken));

    /// <summary>Dias do mês (<c>YYYY-MM</c>, fuso da organização) com tarefa pendente; mesmo escopo da listagem.</summary>
    [HttpGet("calendar")]
    public async Task<ActionResult<IReadOnlyList<TaskCalendarDayDto>>> Calendar(
        [FromQuery] string month,
        [FromQuery] Guid? ownerUserId,
        [FromQuery] bool allOwners = false,
        CancellationToken cancellationToken = default) =>
        Ok(await sender.Send(new GetTaskCalendarQuery(month, ownerUserId, allOwners), cancellationToken));
}

public record RescheduleTaskRequest(DateTime DueDate);

public record ReassignTaskRequest(Guid OwnerUserId);

/// <summary>Corpo do <c>POST /api/tasks</c>. Separado de <c>CreateTaskRequest</c> (ingestão), que não aceita responsável.</summary>
public record CreateTaskBody(
    Guid DealId,
    ActivityType Type,
    DateTime DueDate,
    Guid? OwnerUserId,
    string? Note);
