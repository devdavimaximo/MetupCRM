using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Application.Tasks.Common;
using Metup.Domain.Users;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Tasks.Queries.ListTasks;

public class ListTasksQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<ListTasksQuery, PagedResult<TaskDto>>
{
    public async Task<PagedResult<TaskDto>> Handle(ListTasksQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var currentUserId = currentUserService.RequireUserId();
        var ownerUserId = request.OwnerUserId ?? currentUserId;

        if (ownerUserId != currentUserId && currentUserService.Role is not (nameof(UserRole.Admin) or nameof(UserRole.Closer)))
        {
            throw new ForbiddenAccessException("Sem permissão para ver as tarefas de outro usuário.");
        }

        var query = context.Tasks
            .AsNoTracking()
            .Where(t => t.OrganizationId == organizationId && t.OwnerUserId == ownerUserId);

        if (request.Status is { } status)
        {
            query = query.Where(t => t.Status == status);
        }

        if (request.DueFrom is { } dueFrom)
        {
            query = query.Where(t => t.DueDate >= dueFrom);
        }

        if (request.DueTo is { } dueTo)
        {
            query = query.Where(t => t.DueDate <= dueTo);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(t => t.DueDate)
            .ThenBy(t => t.Id)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToTaskDto(context)
            .ToListAsync(cancellationToken);

        return new PagedResult<TaskDto>(items, request.Page, request.PageSize, totalCount);
    }
}
