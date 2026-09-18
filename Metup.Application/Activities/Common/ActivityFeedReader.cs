using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Domain.Activities;
using Metup.Domain.Deals;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Activities.Common;

/// <summary>
/// O que o feed pede: a posição (<c>After</c>, nulo na primeira página), os filtros (vazio = tudo),
/// o responsável dos negócios (só vale quando o escopo alcança a organização) e o tamanho da página.
/// </summary>
public sealed record ActivityFeedRequest(
    ActivityFeedCursor? After,
    IReadOnlyCollection<ActivityFeedFilter> Filters,
    Guid? OwnerUserId,
    int PageSize);

/// <summary>
/// Composição única do feed da operação: <see cref="Activity"/> + <see cref="StageChange"/>, do mais
/// recente para trás. Usada pelo overview (os 5 últimos) e pelo "Ver todas" (paginado).
///
/// O escopo segue o <b>negócio</b> (<c>Deal.OwnerUserId</c>), nunca o autor: o SDR vê o que aconteceu
/// nos negócios dele, inclusive o que outra pessoa registrou, e nada dos negócios alheios.
///
/// Paginação por cursor sem carregar tudo: cada fonte busca <c>PageSize + 1</c> linhas mais antigas
/// que o cursor e completa o grupo de mesmo instante da borda; o merge ordena por (instante desc, id).
/// O desempate por id é feito em memória, e não no banco, porque a ordem de <c>uuid</c> no Postgres
/// não é a do <see cref="Guid.CompareTo(Guid)"/> do .NET — comparar no banco duplicaria ou pularia
/// itens de mesmo instante entre páginas.
/// </summary>
public sealed class ActivityFeedReader(IApplicationDbContext context, IOrganizationClock clock)
{
    public async Task<ActivityFeedPageDto> ReadAsync(
        DealScopeFilter scope,
        ActivityFeedRequest request,
        CancellationToken cancellationToken)
    {
        var ownerUserId = scope.OwnerUserId ?? request.OwnerUserId;
        var take = request.PageSize + 1;
        var filters = request.Filters.Count == 0 ? Enum.GetValues<ActivityFeedFilter>() : request.Filters;

        var rows = new List<FeedRow>();
        rows.AddRange(await ReadActivitiesAsync(scope.OrganizationId, ownerUserId, filters, request.After, take, cancellationToken));
        rows.AddRange(await ReadStageChangesAsync(scope.OrganizationId, ownerUserId, filters, request.After, take, cancellationToken));

        var ordered = rows
            .DistinctBy(r => r.Id)
            .Where(r => request.After is not { } after || FeedOrder.IsAfter(r.OccurredAt, r.Id, after))
            .OrderByDescending(r => r.OccurredAt)
            .ThenByDescending(r => FeedOrder.TieKey(r.Id), StringComparer.Ordinal)
            .Take(take)
            .ToList();

        var page = ordered.Take(request.PageSize).ToList();
        var nextCursor = ordered.Count > request.PageSize
            ? new ActivityFeedCursor(page[^1].OccurredAt, page[^1].Id).Encode()
            : null;

        return new ActivityFeedPageDto(await ToItemsAsync(scope.OrganizationId, page, cancellationToken), nextCursor);
    }

    private async Task<List<FeedRow>> ReadActivitiesAsync(
        Guid organizationId,
        Guid? ownerUserId,
        IReadOnlyCollection<ActivityFeedFilter> filters,
        ActivityFeedCursor? after,
        int take,
        CancellationToken cancellationToken)
    {
        var types = filters.Select(ToActivityType).OfType<ActivityType>().ToList();
        if (types.Count == 0)
        {
            return [];
        }

        var activities = context.Activities
            .AsNoTracking()
            .Where(a => a.OrganizationId == organizationId && types.Contains(a.Type));

        if (ownerUserId is { } owner)
        {
            activities = activities.Where(a => context.Deals.Any(d => d.Id == a.DealId && d.OwnerUserId == owner));
        }

        var rows = new List<FeedRow>();

        if (after is { } cursor)
        {
            var at = cursor.OccurredAt;
            rows.AddRange(await activities.Where(a => a.OccurredAt == at).Select(ActivityRow).ToListAsync(cancellationToken));
            activities = activities.Where(a => a.OccurredAt < at);
        }

        var older = await activities
            .OrderByDescending(a => a.OccurredAt)
            .Take(take)
            .Select(ActivityRow)
            .ToListAsync(cancellationToken);
        rows.AddRange(older);

        if (older.Count == take)
        {
            var edge = older[^1].OccurredAt;
            rows.AddRange(await activities.Where(a => a.OccurredAt == edge).Select(ActivityRow).ToListAsync(cancellationToken));
        }

        return rows;
    }

    private async Task<List<FeedRow>> ReadStageChangesAsync(
        Guid organizationId,
        Guid? ownerUserId,
        IReadOnlyCollection<ActivityFeedFilter> filters,
        ActivityFeedCursor? after,
        int take,
        CancellationToken cancellationToken)
    {
        var created = filters.Contains(ActivityFeedFilter.DealCreated);
        var advanced = filters.Contains(ActivityFeedFilter.StageAdvanced);
        var won = filters.Contains(ActivityFeedFilter.DealWon);
        var lost = filters.Contains(ActivityFeedFilter.DealLost);
        if (!(created || advanced || won || lost))
        {
            return [];
        }

        var stageChanges = context.StageChanges
            .AsNoTracking()
            .Where(sc => sc.OrganizationId == organizationId
                && ((created && sc.FromStage == null)
                    || (won && sc.ToStage == DealStage.Ganho)
                    || (lost && sc.ToStage == DealStage.Perdido)
                    || (advanced && sc.FromStage != null && sc.ToStage != DealStage.Ganho && sc.ToStage != DealStage.Perdido)));

        if (ownerUserId is { } owner)
        {
            stageChanges = stageChanges.Where(sc => context.Deals.Any(d => d.Id == sc.DealId && d.OwnerUserId == owner));
        }

        var rows = new List<FeedRow>();

        if (after is { } cursor)
        {
            var at = cursor.OccurredAt;
            rows.AddRange(await stageChanges.Where(sc => sc.ChangedAt == at).Select(StageChangeRow).ToListAsync(cancellationToken));
            stageChanges = stageChanges.Where(sc => sc.ChangedAt < at);
        }

        var older = await stageChanges
            .OrderByDescending(sc => sc.ChangedAt)
            .Take(take)
            .Select(StageChangeRow)
            .ToListAsync(cancellationToken);
        rows.AddRange(older);

        if (older.Count == take)
        {
            var edge = older[^1].OccurredAt;
            rows.AddRange(await stageChanges.Where(sc => sc.ChangedAt == edge).Select(StageChangeRow).ToListAsync(cancellationToken));
        }

        return rows;
    }

    /// <summary>Nomes de empresa e autor, o dia local e o valor do ganho, só para os itens da página.</summary>
    private async Task<IReadOnlyList<ActivityFeedItemDto>> ToItemsAsync(
        Guid organizationId,
        IReadOnlyList<FeedRow> page,
        CancellationToken cancellationToken)
    {
        if (page.Count == 0)
        {
            return [];
        }

        var dealIds = page.Select(r => r.DealId).Distinct().ToList();
        var actorIds = page.Select(r => r.ActorUserId).Distinct().ToList();

        var deals = await context.Deals
            .AsNoTracking()
            .Where(d => d.OrganizationId == organizationId && dealIds.Contains(d.Id))
            .Select(d => new { d.Id, d.Amount, CompanyName = context.Companies.Where(c => c.Id == d.CompanyId).Select(c => c.Name).FirstOrDefault() })
            .ToDictionaryAsync(d => d.Id, cancellationToken);

        var actors = await context.Users
            .AsNoTracking()
            .Where(u => u.OrganizationId == organizationId && actorIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Name, cancellationToken);

        var now = await clock.SnapshotAsync(cancellationToken);

        return page
            .Select(r =>
            {
                var deal = deals.GetValueOrDefault(r.DealId);
                return new ActivityFeedItemDto(
                    r.Id,
                    r.Kind,
                    r.DealId,
                    deal?.CompanyName ?? "—",
                    actors.GetValueOrDefault(r.ActorUserId, "—"),
                    r.OccurredAt,
                    now.LocalDateOf(r.OccurredAt),
                    r.ToStage,
                    r.ActivityType,
                    r.Outcome,
                    r.Kind == ActivityFeedKind.DealWon ? deal?.Amount : null);
            })
            .ToList();
    }

    private static ActivityType? ToActivityType(ActivityFeedFilter filter) => filter switch
    {
        ActivityFeedFilter.Call => ActivityType.Call,
        ActivityFeedFilter.WhatsApp => ActivityType.WhatsApp,
        ActivityFeedFilter.Meeting => ActivityType.Meeting,
        ActivityFeedFilter.Proposal => ActivityType.Proposal,
        ActivityFeedFilter.Note => ActivityType.Note,
        _ => null,
    };

    private static readonly System.Linq.Expressions.Expression<Func<Activity, FeedRow>> ActivityRow = a =>
        new FeedRow(a.Id, ActivityFeedKind.Activity, a.DealId, a.AuthorUserId, a.OccurredAt, null, a.Type, a.Outcome);

    private static readonly System.Linq.Expressions.Expression<Func<StageChange, FeedRow>> StageChangeRow = sc =>
        new FeedRow(
            sc.Id,
            sc.ToStage == DealStage.Ganho ? ActivityFeedKind.DealWon
                : sc.ToStage == DealStage.Perdido ? ActivityFeedKind.DealLost
                : sc.FromStage == null ? ActivityFeedKind.DealCreated
                : ActivityFeedKind.StageAdvanced,
            sc.DealId,
            sc.ChangedByUserId,
            sc.ChangedAt,
            sc.ToStage,
            null,
            null);

    private sealed record FeedRow(
        Guid Id,
        ActivityFeedKind Kind,
        Guid DealId,
        Guid ActorUserId,
        DateTime OccurredAt,
        DealStage? ToStage,
        ActivityType? ActivityType,
        ActivityOutcome? Outcome);
}

/// <summary>A ordem total do feed: instante decrescente e, no empate, o id em texto decrescente.</summary>
internal static class FeedOrder
{
    public static string TieKey(Guid id) => id.ToString("N");

    /// <summary>O item vem depois do cursor nessa ordem (ou seja, ainda não foi entregue).</summary>
    public static bool IsAfter(DateTime occurredAt, Guid id, ActivityFeedCursor cursor) =>
        occurredAt < cursor.OccurredAt
        || (occurredAt == cursor.OccurredAt && string.CompareOrdinal(TieKey(id), TieKey(cursor.Id)) < 0);
}
