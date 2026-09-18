using Metup.Application.Common.Models;
using Metup.Application.Tasks.Common;
using Metup.Domain.Activities;
using Metup.Domain.Deals;
using Metup.Domain.Tasks;
using MediatR;

namespace Metup.Application.Tasks.Queries.ListTasks;

/// <param name="OwnerUserId">
/// Sem filtro = tarefas do usuário logado ("minhas tarefas" da V1). Informar outro usuário só é
/// permitido para Admin/Closer — ver <c>ResolveTaskOwnerScope</c>.
/// </param>
/// <param name="Status">Filtro legado de status único (a TasksPage atual). Soma-se a <paramref name="Statuses"/>.</param>
/// <param name="DueFrom">Legado: junto com DueTo, compõe os recortes vencidas/hoje/futuras no client.</param>
/// <param name="Scope">
/// Recorte de prazo calculado no servidor (<see cref="TaskWindows"/>). Nulo = comportamento legado,
/// sem recorte: todas as tarefas do responsável, de qualquer status e data.
/// </param>
/// <param name="ReferenceDate">Dia local da organização que ancora os recortes. Nulo = hoje.</param>
/// <param name="AllOwners">"Todos os responsáveis" — só Admin/Closer; tem precedência sobre OwnerUserId.</param>
/// <param name="Search">Contém, sem acento nem caixa, no nome da empresa ou na nota.</param>
public record ListTasksQuery(
    Guid? OwnerUserId = null,
    TaskItemStatus? Status = null,
    DateTime? DueFrom = null,
    DateTime? DueTo = null,
    int Page = 1,
    int PageSize = 50,
    TaskScope? Scope = null,
    DateOnly? ReferenceDate = null,
    IReadOnlyList<TaskItemStatus>? Statuses = null,
    IReadOnlyList<ActivityType>? Types = null,
    IReadOnlyList<DealStage>? DealStages = null,
    string? Search = null,
    bool AllOwners = false,
    TaskSort Sort = TaskSort.DueAsc) : IRequest<PagedResult<TaskDto>>;
