using Metup.Application.Common.Interfaces;
using Metup.Application.Deals.Analytics;
using Metup.Application.Notifications.Common;
using Metup.Domain.Conversations;
using Metup.Domain.Deals;
using Metup.Domain.Organizations;
using Metup.Domain.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Notifications.Queries.GetNotifications;

/// <summary>
/// Notificações derivadas, sem tabela: cada regra é uma consulta sobre o estado atual. "Lida" é do
/// front (última abertura do sino), então nada aqui guarda estado por usuário.
///
/// Escopo: tarefas são sempre do próprio usuário. Negócios parados seguem <c>ResolveDealScope</c>
/// (Admin/Closer: organização; SDR: carteira dele), como o dashboard. Conversas são da organização,
/// como a Inbox.
/// </summary>
public class GetNotificationsQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock) : IRequestHandler<GetNotificationsQuery, IReadOnlyList<NotificationDto>>
{
    private const int MaxPerKind = GetNotificationsQuery.MaxPerKind;

    public async Task<IReadOnlyList<NotificationDto>> Handle(GetNotificationsQuery request, CancellationToken cancellationToken)
    {
        var scope = currentUserService.ResolveDealScope();
        var userId = currentUserService.RequireUserId();
        var clock = await organizationClock.SnapshotAsync(cancellationToken);
        var now = clock.UtcNow;

        var notifications = new List<NotificationDto>();
        notifications.AddRange(await TasksAsync(scope.OrganizationId, userId, now, cancellationToken));
        notifications.AddRange(await StalledTodayAsync(scope.OrganizationId, scope.OwnerUserId, now, clock.StartOfDayUtc(clock.Today), cancellationToken));
        notifications.AddRange(await AwaitingReplyAsync(scope.OrganizationId, now, cancellationToken));

        return notifications.OrderByDescending(n => n.OccurredAt).ToList();
    }

    private async Task<IEnumerable<NotificationDto>> TasksAsync(Guid organizationId, Guid userId, DateTime now, CancellationToken cancellationToken)
    {
        var dueSoonLimit = now + GetNotificationsQuery.DueSoonWindow;

        var pending = context.Tasks
            .AsNoTracking()
            .Where(t => t.OrganizationId == organizationId && t.OwnerUserId == userId && t.Status == TaskItemStatus.Pendente);

        var overdue = await pending
            .Where(t => t.DueDate <= now)
            .OrderByDescending(t => t.DueDate)
            .Take(MaxPerKind)
            .Select(t => new { t.Id, t.DealId, t.Type, t.DueDate, CompanyName = context.Deals.Where(d => d.Id == t.DealId).Select(d => context.Companies.Where(c => c.Id == d.CompanyId).Select(c => c.Name).FirstOrDefault()).FirstOrDefault() })
            .ToListAsync(cancellationToken);

        var dueSoon = await pending
            .Where(t => t.DueDate > now && t.DueDate <= dueSoonLimit)
            .OrderBy(t => t.DueDate)
            .Take(MaxPerKind)
            .Select(t => new { t.Id, t.DealId, t.Type, t.DueDate, CompanyName = context.Deals.Where(d => d.Id == t.DealId).Select(d => context.Companies.Where(c => c.Id == d.CompanyId).Select(c => c.Name).FirstOrDefault()).FirstOrDefault() })
            .ToListAsync(cancellationToken);

        return overdue
            .Select(t => new NotificationDto(
                $"task-overdue:{t.Id}", NotificationKind.TaskOverdue, NotificationSeverity.Critical,
                t.DueDate, t.DueDate, t.CompanyName ?? "—", t.DealId, t.Id, null, t.Type, null))
            .Concat(dueSoon.Select(t => new NotificationDto(
                $"task-due-soon:{t.Id}", NotificationKind.TaskDueSoon, NotificationSeverity.Warning,
                t.DueDate - GetNotificationsQuery.DueSoonWindow, t.DueDate, t.CompanyName ?? "—", t.DealId, t.Id, null, t.Type, null)));
    }

    /// <summary>
    /// Negócios abertos cujo instante de "virar parado" (<see cref="StalledDealRule.StalledAt"/>) caiu
    /// entre o começo de hoje, no fuso da organização, e agora.
    /// </summary>
    private async Task<IEnumerable<NotificationDto>> StalledTodayAsync(
        Guid organizationId,
        Guid? ownerUserId,
        DateTime now,
        DateTime startOfTodayUtc,
        CancellationToken cancellationToken)
    {
        var stalledDealDays = await context.Organizations
            .AsNoTracking()
            .Where(o => o.Id == organizationId)
            .Select(o => (int?)o.StalledDealDays)
            .FirstOrDefaultAsync(cancellationToken) ?? Organization.DefaultStalledDealDays;

        // StalledAt(last) ∈ [início de hoje, agora]  ⇔  last ∈ [início de hoje − (N+1)d, agora − (N+1)d].
        var offset = StalledDealRule.StalledAt(DateTime.UnixEpoch, stalledDealDays) - DateTime.UnixEpoch;
        var from = startOfTodayUtc - offset;
        var to = now - offset;

        var openDeals = context.Deals
            .AsNoTracking()
            .Where(d => d.OrganizationId == organizationId && d.Status == DealStatus.Aberto);
        if (ownerUserId is { } owner)
        {
            openDeals = openDeals.Where(d => d.OwnerUserId == owner);
        }

        var lastChanges = context.StageChanges
            .AsNoTracking()
            .Where(sc => sc.OrganizationId == organizationId)
            .GroupBy(sc => sc.DealId)
            .Select(g => new { DealId = g.Key, LastChangedAt = g.Max(sc => sc.ChangedAt) })
            .Where(g => g.LastChangedAt >= from && g.LastChangedAt <= to);

        var stalled = await openDeals
            .Join(lastChanges, d => d.Id, g => g.DealId, (d, g) => new { d.Id, d.CompanyId, g.LastChangedAt })
            .OrderByDescending(x => x.LastChangedAt)
            .Take(MaxPerKind)
            .Select(x => new
            {
                x.Id,
                x.LastChangedAt,
                CompanyName = context.Companies.Where(c => c.Id == x.CompanyId).Select(c => c.Name).FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        return stalled.Select(x => new NotificationDto(
            $"deal-stalled:{x.Id}:{startOfTodayUtc:yyyyMMdd}", NotificationKind.DealStalledToday, NotificationSeverity.Warning,
            StalledDealRule.StalledAt(x.LastChangedAt, stalledDealDays), null, x.CompanyName ?? "—",
            x.Id, null, null, null, stalledDealDays));
    }

    private async Task<IEnumerable<NotificationDto>> AwaitingReplyAsync(Guid organizationId, DateTime now, CancellationToken cancellationToken)
    {
        var cutoff = now - GetNotificationsQuery.AwaitingReplyAfter;

        var awaiting = await context.Conversations
            .AsNoTracking()
            .Where(c => c.OrganizationId == organizationId)
            .Select(c => new
            {
                c.Id,
                c.ContactId,
                Last = context.Messages
                    .Where(m => m.ConversationId == c.Id)
                    .OrderByDescending(m => m.OccurredAt)
                    .Select(m => new { m.Direction, m.OccurredAt, m.DealId })
                    .FirstOrDefault(),
            })
            .Where(x => x.Last != null && x.Last.Direction == MessageDirection.Inbound && x.Last.OccurredAt <= cutoff)
            .OrderByDescending(x => x.Last!.OccurredAt)
            .Take(MaxPerKind)
            .Select(x => new
            {
                x.Id,
                x.Last!.OccurredAt,
                x.Last.DealId,
                ContactName = context.Contacts.Where(ct => ct.Id == x.ContactId).Select(ct => ct.Name).FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        return awaiting.Select(x => new NotificationDto(
            $"conversation-awaiting:{x.Id}:{x.OccurredAt.Ticks}", NotificationKind.ConversationAwaitingReply, NotificationSeverity.Warning,
            x.OccurredAt + GetNotificationsQuery.AwaitingReplyAfter, x.OccurredAt, x.ContactName ?? "—",
            x.DealId, null, x.Id, null, null));
    }
}
