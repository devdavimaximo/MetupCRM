using Metup.Application.Common.Interfaces;
using Metup.Application.Dashboard.Common;
using Metup.Application.Tasks.Common;
using Metup.Domain.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Dashboard.Queries.GetDashboardSummary;

public class GetDashboardSummaryQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock) : IRequestHandler<GetDashboardSummaryQuery, DashboardSummaryDto>
{
    public async Task<DashboardSummaryDto> Handle(GetDashboardSummaryQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        // Mesmos recortes de prazo do bucketOf() do front (overdue/today/upcoming), com o dia
        // recortado no fuso da organização: a tarefa das 22h de hoje em Brasília é "hoje".
        var clock = await organizationClock.SnapshotAsync(cancellationToken);
        var now = clock.UtcNow;
        var endOfToday = clock.EndOfDayUtc(clock.Today);

        var pendingTasks = context.Tasks
            .AsNoTracking()
            .Where(t => t.OrganizationId == organizationId
                && t.OwnerUserId == userId
                && t.Status == TaskItemStatus.Pendente);

        var taskCounts = new TaskCountsDto(
            await pendingTasks.CountAsync(t => t.DueDate < now, cancellationToken),
            await pendingTasks.CountAsync(t => t.DueDate >= now && t.DueDate <= endOfToday, cancellationToken),
            await pendingTasks.CountAsync(t => t.DueDate > endOfToday, cancellationToken));

        // Fila curta em ordem de prazo, incluindo o que vem depois de hoje — o painel lateral do dashboard.
        var nextTasks = await pendingTasks
            .OrderBy(t => t.DueDate)
            .ThenBy(t => t.Id)
            .Take(5)
            .ToTaskDto(context)
            .ToListAsync(cancellationToken);

        return new DashboardSummaryDto(taskCounts, nextTasks);
    }
}
