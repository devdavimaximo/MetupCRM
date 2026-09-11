using Metup.Application.Common.Models;
using Metup.Application.Tasks.Common;
using Metup.Domain.Tasks;
using MediatR;

namespace Metup.Application.Tasks.Queries.ListTasks;

/// <param name="OwnerUserId">Sem filtro = tarefas do usuário logado ("minhas tarefas" da V1).</param>
/// <param name="DueFrom">Junto com DueTo, compõe os recortes vencidas/hoje/futuras no client.</param>
public record ListTasksQuery(
    Guid? OwnerUserId = null,
    TaskItemStatus? Status = null,
    DateTime? DueFrom = null,
    DateTime? DueTo = null,
    int Page = 1,
    int PageSize = 50) : IRequest<PagedResult<TaskDto>>;
