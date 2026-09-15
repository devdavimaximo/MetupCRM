using Metup.Application.Common.Interfaces;
using Metup.Application.Dashboard.Common;
using Metup.Application.Tasks.Common;
using Metup.Domain.Deals;
using Metup.Domain.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Dashboard.Queries.GetDashboardSummary;

public class GetDashboardSummaryQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetDashboardSummaryQuery, DashboardSummaryDto>
{
    public async Task<DashboardSummaryDto> Handle(GetDashboardSummaryQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        // Mesmos recortes de prazo do bucketOf() do front (overdue/today/upcoming), mas em UTC —
        // suficiente para a fotografia de hoje da V1, sem timezone por usuário/organização ainda.
        var now = DateTime.UtcNow;
        var endOfToday = now.Date.AddDays(1).AddTicks(-1);

        var pendingTasks = context.Tasks
            .AsNoTracking()
            .Where(t => t.OrganizationId == organizationId
                && t.OwnerUserId == userId
                && t.Status == TaskItemStatus.Pendente);

        var taskCounts = new TaskCountsDto(
            await pendingTasks.CountAsync(t => t.DueDate < now, cancellationToken),
            await pendingTasks.CountAsync(t => t.DueDate >= now && t.DueDate <= endOfToday, cancellationToken),
            await pendingTasks.CountAsync(t => t.DueDate > endOfToday, cancellationToken));

        var todayTasks = await pendingTasks
            .Where(t => t.DueDate <= endOfToday)
            .OrderBy(t => t.DueDate)
            .ThenBy(t => t.Id)
            .ToTaskDto(context)
            .ToListAsync(cancellationToken);

        // Fila curta em ordem de prazo, incluindo o que vem depois de hoje — o painel lateral do dashboard.
        var nextTasks = await pendingTasks
            .OrderBy(t => t.DueDate)
            .ThenBy(t => t.Id)
            .Take(5)
            .ToTaskDto(context)
            .ToListAsync(cancellationToken);

        var openDealsByStage = await context.Deals
            .AsNoTracking()
            .Where(d => d.OrganizationId == organizationId && d.Status == DealStatus.Aberto)
            .GroupBy(d => d.Stage)
            .Select(g => new DealsByStageDto(g.Key, g.Count()))
            .ToListAsync(cancellationToken);

        var activitiesToday = await context.Activities
            .AsNoTracking()
            .Where(a => a.OrganizationId == organizationId
                && a.AuthorUserId == userId
                && a.OccurredAt >= now.Date
                && a.OccurredAt <= endOfToday)
            .GroupBy(a => a.Type)
            .Select(g => new ActivitiesByTypeDto(g.Key, g.Count()))
            .ToListAsync(cancellationToken);

        return new DashboardSummaryDto(
            taskCounts,
            todayTasks,
            nextTasks,
            openDealsByStage,
            openDealsByStage.Sum(d => d.Count),
            activitiesToday,
            activitiesToday.Sum(a => a.Count));
    }
}
