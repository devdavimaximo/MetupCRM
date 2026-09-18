using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Application.Tasks.Common;
using Metup.Domain.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Tasks.Queries.ListTasks;

/// <summary>
/// Listagem paginada da tela de Tarefas. Quem pode ver de quem vem de <c>ResolveTaskOwnerScope</c>;
/// os recortes de prazo, de <see cref="TaskWindows"/> — as mesmas regras do resumo, então a contagem
/// de cada aba é o <c>totalCount</c> daqui.
/// </summary>
public class ListTasksQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock,
    ITextSearch textSearch) : IRequestHandler<ListTasksQuery, PagedResult<TaskDto>>
{
    public async Task<PagedResult<TaskDto>> Handle(ListTasksQuery request, CancellationToken cancellationToken)
    {
        var owners = currentUserService.ResolveTaskOwnerScope(request.OwnerUserId, request.AllOwners);

        var query = context.Tasks.AsNoTracking().OwnedBy(owners);

        var statuses = request.Statuses ?? [];
        if (request.Status is { } legacyStatus)
        {
            statuses = [.. statuses, legacyStatus];
        }

        if (request.Scope is { } scope)
        {
            var clock = await organizationClock.SnapshotAsync(cancellationToken);
            var windows = TaskWindows.For(clock, request.ReferenceDate ?? clock.Today);
            query = windows.Apply(query, scope, statuses);
        }
        else if (statuses.Count > 0)
        {
            query = query.Where(t => statuses.Contains(t.Status));
        }

        query = ApplyFilters(query, request);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await Sort(query, request.Sort)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToTaskDto(context)
            .ToListAsync(cancellationToken);

        return new PagedResult<TaskDto>(items, request.Page, request.PageSize, totalCount);
    }

    private IQueryable<TaskItem> ApplyFilters(IQueryable<TaskItem> query, ListTasksQuery request)
    {
        if (request.DueFrom is { } dueFrom)
        {
            query = query.Where(t => t.DueDate >= dueFrom);
        }

        if (request.DueTo is { } dueTo)
        {
            query = query.Where(t => t.DueDate <= dueTo);
        }

        if (request.Types is { Count: > 0 } types)
        {
            query = query.Where(t => types.Contains(t.Type));
        }

        if (request.DealStages is { Count: > 0 } stages)
        {
            query = query.Where(t => context.Deals.Any(d => d.Id == t.DealId && stages.Contains(d.Stage)));
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim();
            var byNote = textSearch.WhereAnyContains(query, term, t => t.Note).Select(t => t.Id);
            var byCompany = textSearch.WhereAnyContains(context.Companies, term, c => c.Name).Select(c => c.Id);

            query = query.Where(t => byNote.Contains(t.Id)
                || context.Deals.Any(d => d.Id == t.DealId && byCompany.Contains(d.CompanyId)));
        }

        return query;
    }

    private IQueryable<TaskItem> Sort(IQueryable<TaskItem> query, TaskSort sort) => sort switch
    {
        TaskSort.DueDesc => query.OrderByDescending(t => t.DueDate).ThenBy(t => t.Id),
        TaskSort.Recent => query.OrderByDescending(t => t.CreatedAt).ThenBy(t => t.Id),
        TaskSort.Owner => query
            .OrderBy(t => context.Users.Where(u => u.Id == t.OwnerUserId).Select(u => u.Name).FirstOrDefault())
            .ThenBy(t => t.DueDate)
            .ThenBy(t => t.Id),
        // Abertas primeiro, depois concluídas e canceladas — a ordem de trabalho, não a alfabética do enum salvo como texto.
        TaskSort.Status => query
            .OrderBy(t => t.Status == TaskItemStatus.Pendente ? 0 : t.Status == TaskItemStatus.Concluida ? 1 : 2)
            .ThenBy(t => t.DueDate)
            .ThenBy(t => t.Id),
        _ => query.OrderBy(t => t.DueDate).ThenBy(t => t.Id),
    };
}
