using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Application.Tasks.Common;
using Metup.Domain.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Tasks.Queries.GetTaskSummary;

/// <summary>
/// Resumo da tela de Tarefas. As contagens reaplicam <see cref="TaskWindows"/> — exatamente o filtro
/// da listagem — e tudo é contado no banco.
/// <para>
/// <b>7 dias antes.</b> O instante de comparação é o agora − 7 dias (referência = hoje) ou o fim do
/// dia D−7 (outra referência). Conta a tarefa que já existia e ainda não estava concluída nem
/// cancelada nesse instante, pelo <b>prazo vigente</b> nele: o último <c>ToDueDate</c> reagendado até
/// ali; se ela só foi reagendada depois, o primeiro <c>FromDueDate</c>; sem reagendamento, o
/// <c>DueDate</c>. Reagendamentos anteriores ao histórico existir continuam aproximados.
/// </para>
/// </summary>
public class GetTaskSummaryQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock) : IRequestHandler<GetTaskSummaryQuery, TaskSummaryDto>
{
    private const int SeriesDays = 14;

    public async Task<TaskSummaryDto> Handle(GetTaskSummaryQuery request, CancellationToken cancellationToken)
    {
        var owners = currentUserService.ResolveTaskOwnerScope(request.OwnerUserId, request.AllOwners);
        var clock = await organizationClock.SnapshotAsync(cancellationToken);
        var referenceDate = request.ReferenceDate ?? clock.Today;
        var windows = TaskWindows.For(clock, referenceDate);

        var tasks = context.Tasks.AsNoTracking().OwnedBy(owners);

        var counts = new TaskScopeCountsDto(
            await windows.Apply(tasks, TaskScope.All, null).CountAsync(cancellationToken),
            await windows.Apply(tasks, TaskScope.Overdue, null).CountAsync(cancellationToken),
            await windows.Apply(tasks, TaskScope.Today, null).CountAsync(cancellationToken),
            await windows.Apply(tasks, TaskScope.ThisWeek, null).CountAsync(cancellationToken),
            await windows.Apply(tasks, TaskScope.Later, null).CountAsync(cancellationToken),
            await windows.Apply(tasks, TaskScope.All, [TaskItemStatus.Concluida]).CountAsync(cancellationToken),
            await windows.Apply(tasks, TaskScope.All, [TaskItemStatus.Cancelada]).CountAsync(cancellationToken));

        var previous = await PreviousAsync(tasks, owners.OrganizationId, clock, referenceDate, cancellationToken);
        var series = await CompletedPerDayAsync(tasks, clock, referenceDate, cancellationToken);

        var thisWeek = series.Skip(SeriesDays / 2).Sum(p => p.Count);
        var previousWeek = series.Take(SeriesDays / 2).Sum(p => p.Count);
        decimal? changePct = previousWeek == 0
            ? null
            : Math.Round((thisWeek - previousWeek) * 100m / previousWeek, 1, MidpointRounding.AwayFromZero);

        return new TaskSummaryDto(referenceDate, counts, previous, series, thisWeek, previousWeek, changePct);
    }

    private async Task<TaskPreviousCountsDto?> PreviousAsync(
        IQueryable<TaskItem> tasks,
        Guid organizationId,
        OrganizationClockSnapshot clock,
        DateOnly referenceDate,
        CancellationToken cancellationToken)
    {
        var previousDate = referenceDate.AddDays(-7);
        var live = referenceDate == clock.Today;
        var asOf = live ? clock.UtcNow.AddDays(-7) : clock.EndOfDayUtc(previousDate);
        var windows = TaskWindows.At(clock, previousDate, live ? asOf : clock.StartOfDayUtc(previousDate));

        if (!await tasks.AnyAsync(t => t.CreatedAt <= asOf, cancellationToken))
        {
            return null;
        }

        var reschedules = context.TaskReschedules.Where(r => r.OrganizationId == organizationId);

        var openThen = tasks
            .Where(t => t.CreatedAt <= asOf && (t.CompletedAt == null || t.CompletedAt > asOf))
            .Select(t => new
            {
                DueDate = reschedules
                        .Where(r => r.TaskId == t.Id && r.RescheduledAt <= asOf)
                        .OrderByDescending(r => r.RescheduledAt)
                        .Select(r => (DateTime?)r.ToDueDate)
                        .FirstOrDefault()
                    ?? reschedules
                        .Where(r => r.TaskId == t.Id && r.RescheduledAt > asOf)
                        .OrderBy(r => r.RescheduledAt)
                        .Select(r => (DateTime?)r.FromDueDate)
                        .FirstOrDefault()
                    ?? t.DueDate,
            });

        return new TaskPreviousCountsDto(
            await openThen.CountAsync(t => t.DueDate < windows.OverdueBeforeUtc, cancellationToken),
            await openThen.CountAsync(t => t.DueDate >= windows.OverdueBeforeUtc && t.DueDate < windows.ReferenceDayEndUtc, cancellationToken),
            await openThen.CountAsync(t => t.DueDate >= windows.ReferenceDayEndUtc && t.DueDate < windows.WeekEndUtc, cancellationToken));
    }

    /// <summary>Concluídas por dia local, agrupadas no banco (<see cref="LocalDayIndex"/>).</summary>
    private static async Task<IReadOnlyList<DailyCountDto>> CompletedPerDayAsync(
        IQueryable<TaskItem> tasks,
        OrganizationClockSnapshot clock,
        DateOnly referenceDate,
        CancellationToken cancellationToken)
    {
        var firstDay = referenceDate.AddDays(1 - SeriesDays);
        var dayStarts = LocalDayIndex.DayStarts(clock, firstDay, SeriesDays);
        var from = dayStarts[0];
        var to = dayStarts[^1];

        var perDay = await tasks
            .Where(t => t.Status == TaskItemStatus.Concluida && t.CompletedAt >= from && t.CompletedAt < to)
            .GroupBy(LocalDayIndex.Of(t => t.CompletedAt, dayStarts))
            .Select(g => new { Day = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Day, x => x.Count, cancellationToken);

        return Enumerable.Range(0, SeriesDays)
            .Select(i => new DailyCountDto(firstDay.AddDays(i), perDay.GetValueOrDefault(i)))
            .ToList();
    }
}
