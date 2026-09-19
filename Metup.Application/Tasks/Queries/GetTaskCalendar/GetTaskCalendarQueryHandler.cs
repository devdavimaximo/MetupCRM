using Metup.Application.Common.Interfaces;
using Metup.Application.Tasks.Common;
using Metup.Domain.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Tasks.Queries.GetTaskCalendar;

/// <summary>
/// "Aberta" = pendente com prazo no dia; "atrasada" = aberta com prazo antes de agora. Agrupado no
/// banco pelo dia local (<see cref="LocalDayIndex"/>), com o mesmo escopo de responsável da listagem.
/// </summary>
public class GetTaskCalendarQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock) : IRequestHandler<GetTaskCalendarQuery, IReadOnlyList<TaskCalendarDayDto>>
{
    public async Task<IReadOnlyList<TaskCalendarDayDto>> Handle(GetTaskCalendarQuery request, CancellationToken cancellationToken)
    {
        var owners = currentUserService.ResolveTaskOwnerScope(request.OwnerUserId, request.AllOwners);
        var clock = await organizationClock.SnapshotAsync(cancellationToken);

        GetTaskCalendarQuery.TryParseMonth(request.Month, out var firstDay);
        var days = DateTime.DaysInMonth(firstDay.Year, firstDay.Month);
        var dayStarts = LocalDayIndex.DayStarts(clock, firstDay, days);
        var from = dayStarts[0];
        var to = dayStarts[^1];
        var now = clock.UtcNow;

        var perDay = await context.Tasks
            .AsNoTracking()
            .OwnedBy(owners)
            .Where(t => t.Status == TaskItemStatus.Pendente && t.DueDate >= from && t.DueDate < to)
            .GroupBy(LocalDayIndex.Of(t => t.DueDate, dayStarts))
            .Select(g => new { Day = g.Key, Open = g.Count(), Overdue = g.Count(t => t.DueDate < now) })
            .ToListAsync(cancellationToken);

        return perDay
            .OrderBy(d => d.Day)
            .Select(d => new TaskCalendarDayDto(firstDay.AddDays(d.Day), d.Open, d.Overdue))
            .ToList();
    }
}
