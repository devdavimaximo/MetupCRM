using Metup.Application.Common.Interfaces;
using Metup.Application.Dashboard.Common;
using Metup.Domain.Activities;
using Metup.Domain.Deals;
using Metup.Domain.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Dashboard.Queries.GetDashboardOverview;

/// <summary>
/// Visão da organização inteira (não só do usuário, como o resumo de tarefas): tudo que o
/// dashboard mostra é calculado de Deal, StageChange, Activity e TaskItem — nenhum número sem base.
///
/// Os negócios são lidos numa projeção enxuta e agregados em memória: no volume da V1 isso é
/// uma única ida ao banco e evita GroupBy/DateTrunc dependentes de provedor. Quando o volume
/// crescer, é a candidata natural a tabela de leitura (seção 7 do CLAUDE.md).
/// </summary>
public class GetDashboardOverviewQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetDashboardOverviewQuery, DashboardOverviewDto>
{
    private const int StalledAfterDays = 14;
    private const int FeaturedDealsLimit = 5;
    private const int RecentEventsLimit = 5;

    public async Task<DashboardOverviewDto> Handle(GetDashboardOverviewQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var now = DateTime.UtcNow;
        var periodStart = now.AddDays(-request.Days);
        var previousStart = periodStart.AddDays(-request.Days);

        var deals = await context.Deals
            .AsNoTracking()
            .Where(d => d.OrganizationId == organizationId)
            .Select(d => new DealRow(d.Id, d.CompanyId, d.Stage, d.Source, d.OwnerUserId, d.Amount, d.Status, d.CreatedAt, d.ClosedAt))
            .ToListAsync(cancellationToken);

        bool InPeriod(DateTime? at) => at >= periodStart && at <= now;
        bool InPrevious(DateTime? at) => at >= previousStart && at < periodStart;

        var won = deals.Where(d => d.Status == DealStatus.Ganho).ToList();
        var lost = deals.Where(d => d.Status == DealStatus.Perdido).ToList();
        var open = deals.Where(d => d.Status == DealStatus.Aberto).ToList();

        var revenue = new PeriodValueDto(
            won.Where(d => InPeriod(d.ClosedAt)).Sum(d => d.Amount ?? 0m),
            won.Where(d => InPrevious(d.ClosedAt)).Sum(d => d.Amount ?? 0m));

        var activityCounts = await context.Activities
            .AsNoTracking()
            .Where(a => a.OrganizationId == organizationId && a.OccurredAt >= previousStart && a.OccurredAt <= now)
            .GroupBy(a => new { a.Type, IsCurrent = a.OccurredAt >= periodStart })
            .Select(g => new { g.Key.Type, g.Key.IsCurrent, Count = g.Count() })
            .ToListAsync(cancellationToken);

        PeriodValueDto CountActivities(ActivityType type) => new(
            activityCounts.Where(a => a.Type == type && a.IsCurrent).Sum(a => a.Count),
            activityCounts.Where(a => a.Type == type && !a.IsCurrent).Sum(a => a.Count));

        // Última transição de cada negócio aberto = há quanto tempo ele está no estágio atual.
        var openIds = open.Select(d => d.Id).ToList();
        var lastStageChangeByDeal = await context.StageChanges
            .AsNoTracking()
            .Where(sc => sc.OrganizationId == organizationId && openIds.Contains(sc.DealId))
            .GroupBy(sc => sc.DealId)
            .Select(g => new { DealId = g.Key, LastChangedAt = g.Max(sc => sc.ChangedAt) })
            .ToDictionaryAsync(x => x.DealId, x => x.LastChangedAt, cancellationToken);

        int DaysInStage(DealRow deal) =>
            (int)(now - lastStageChangeByDeal.GetValueOrDefault(deal.Id, deal.CreatedAt)).TotalDays;

        var pipeline = open
            .GroupBy(d => d.Stage)
            .Select(g => new PipelineStageDto(
                g.Key,
                g.Count(),
                g.Sum(d => d.Amount ?? 0m),
                g.Count(d => DaysInStage(d) > StalledAfterDays)))
            .OrderBy(p => p.Stage)
            .ToList();

        var companyNames = await context.Companies
            .AsNoTracking()
            .Where(c => c.OrganizationId == organizationId)
            .ToDictionaryAsync(c => c.Id, c => c.Name, cancellationToken);

        var userNames = await context.Users
            .AsNoTracking()
            .Where(u => u.OrganizationId == organizationId)
            .ToDictionaryAsync(u => u.Id, u => u.Name, cancellationToken);

        string CompanyOf(Guid companyId) => companyNames.GetValueOrDefault(companyId, "—");
        string UserOf(Guid userId) => userNames.GetValueOrDefault(userId, "—");

        var featured = open
            .Where(d => d.Amount.HasValue)
            .OrderByDescending(d => d.Amount)
            .ThenByDescending(d => d.Stage)
            .Take(FeaturedDealsLimit)
            .ToList();

        var featuredIds = featured.Select(d => d.Id).ToList();
        var nextTasks = (await context.Tasks
                .AsNoTracking()
                .Where(t => t.OrganizationId == organizationId
                    && featuredIds.Contains(t.DealId)
                    && t.Status == TaskItemStatus.Pendente)
                .Select(t => new { t.DealId, t.DueDate, t.Type })
                .ToListAsync(cancellationToken))
            .GroupBy(t => t.DealId)
            .ToDictionary(g => g.Key, g => g.OrderBy(t => t.DueDate).First());

        var featuredDeals = featured
            .Select(d =>
            {
                var next = nextTasks.GetValueOrDefault(d.Id);
                return new FeaturedDealDto(
                    d.Id, CompanyOf(d.CompanyId), d.Stage, d.Amount, UserOf(d.OwnerUserId),
                    DaysInStage(d), next?.DueDate, next?.Type);
            })
            .ToList();

        var dealById = deals.ToDictionary(d => d.Id);
        var recentEvents = await LoadRecentEventsAsync(organizationId, dealById, CompanyOf, UserOf, cancellationToken);

        var sources = deals
            .Where(d => InPeriod(d.CreatedAt))
            .GroupBy(d => d.Source)
            .Select(g => new SourceBreakdownDto(
                g.Key,
                g.Count(),
                g.Count(d => d.Status == DealStatus.Ganho),
                g.Where(d => d.Status == DealStatus.Ganho).Sum(d => d.Amount ?? 0m)))
            .OrderByDescending(s => s.NewDeals)
            .ToList();

        var owners = deals
            .GroupBy(d => d.OwnerUserId)
            .Select(g =>
            {
                var wonInPeriod = g.Where(d => d.Status == DealStatus.Ganho && InPeriod(d.ClosedAt)).ToList();
                var openDeals = g.Where(d => d.Status == DealStatus.Aberto).ToList();
                return new OwnerPerformanceDto(
                    g.Key, UserOf(g.Key), wonInPeriod.Count, wonInPeriod.Sum(d => d.Amount ?? 0m),
                    openDeals.Count, openDeals.Sum(d => d.Amount ?? 0m));
            })
            .Where(o => o.WonDeals > 0 || o.OpenDeals > 0)
            .OrderByDescending(o => o.Revenue)
            .ThenByDescending(o => o.OpenAmount)
            .ToList();

        var (series, granularity) = BuildRevenueSeries(won, lost, periodStart, now, request.Days);

        return new DashboardOverviewDto(
            request.Days,
            periodStart,
            now,
            revenue,
            new PeriodValueDto(won.Count(d => InPeriod(d.ClosedAt)), won.Count(d => InPrevious(d.ClosedAt))),
            new PeriodValueDto(lost.Count(d => InPeriod(d.ClosedAt)), lost.Count(d => InPrevious(d.ClosedAt))),
            new PeriodValueDto(deals.Count(d => InPeriod(d.CreatedAt)), deals.Count(d => InPrevious(d.CreatedAt))),
            CountActivities(ActivityType.Proposal),
            CountActivities(ActivityType.Meeting),
            CountActivities(ActivityType.Call),
            series,
            granularity,
            pipeline,
            open.Count(d => !d.Amount.HasValue),
            StalledAfterDays,
            featuredDeals,
            recentEvents,
            sources,
            owners);
    }

    /// <summary>Dias até ~31 pontos; acima disso, semanas — a série fica legível em qualquer período.</summary>
    private static (IReadOnlyList<RevenuePointDto> Series, string Granularity) BuildRevenueSeries(
        IReadOnlyList<DealRow> won, IReadOnlyList<DealRow> lost, DateTime periodStart, DateTime now, int days)
    {
        var bucketDays = days <= 31 ? 1 : 7;
        var firstBucket = now.Date.AddDays(-(Math.Ceiling((double)days / bucketDays) - 1) * bucketDays);
        var points = new List<RevenuePointDto>();

        for (var start = firstBucket; start <= now; start = start.AddDays(bucketDays))
        {
            var bucketStart = start;
            var bucketEnd = start.AddDays(bucketDays);
            bool InBucket(DealRow d) => d.ClosedAt >= bucketStart && d.ClosedAt < bucketEnd && d.ClosedAt >= periodStart;
            var wonInBucket = won.Where(InBucket).ToList();
            points.Add(new RevenuePointDto(bucketStart, wonInBucket.Sum(d => d.Amount ?? 0m), wonInBucket.Count, lost.Count(InBucket)));
        }

        return (points, bucketDays == 1 ? "day" : "week");
    }

    private async Task<IReadOnlyList<RecentEventDto>> LoadRecentEventsAsync(
        Guid organizationId,
        IReadOnlyDictionary<Guid, DealRow> dealById,
        Func<Guid, string> companyOf,
        Func<Guid, string> userOf,
        CancellationToken cancellationToken)
    {
        var activities = await context.Activities
            .AsNoTracking()
            .Where(a => a.OrganizationId == organizationId)
            .OrderByDescending(a => a.OccurredAt)
            .Take(RecentEventsLimit)
            .Select(a => new { a.DealId, a.Type, a.Outcome, a.AuthorUserId, a.OccurredAt })
            .ToListAsync(cancellationToken);

        var stageChanges = await context.StageChanges
            .AsNoTracking()
            .Where(sc => sc.OrganizationId == organizationId)
            .OrderByDescending(sc => sc.ChangedAt)
            .Take(RecentEventsLimit)
            .Select(sc => new { sc.DealId, sc.FromStage, sc.ToStage, sc.ChangedByUserId, sc.ChangedAt })
            .ToListAsync(cancellationToken);

        string CompanyOfDeal(Guid dealId) =>
            dealById.TryGetValue(dealId, out var deal) ? companyOf(deal.CompanyId) : "—";

        var events = activities
            .Select(a => new RecentEventDto(
                RecentEventKind.Activity, a.DealId, CompanyOfDeal(a.DealId), userOf(a.AuthorUserId),
                a.OccurredAt, null, a.Type, a.Outcome, null))
            .Concat(stageChanges.Select(sc => new RecentEventDto(
                sc.ToStage switch
                {
                    DealStage.Ganho => RecentEventKind.DealWon,
                    DealStage.Perdido => RecentEventKind.DealLost,
                    _ when sc.FromStage is null => RecentEventKind.DealCreated,
                    _ => RecentEventKind.StageAdvanced,
                },
                sc.DealId, CompanyOfDeal(sc.DealId), userOf(sc.ChangedByUserId), sc.ChangedAt, sc.ToStage, null, null,
                sc.ToStage == DealStage.Ganho && dealById.TryGetValue(sc.DealId, out var deal) ? deal.Amount : null)));

        return events
            .OrderByDescending(e => e.OccurredAt)
            .Take(RecentEventsLimit)
            .ToList();
    }

    private sealed record DealRow(
        Guid Id,
        Guid CompanyId,
        DealStage Stage,
        DealSource Source,
        Guid OwnerUserId,
        decimal? Amount,
        DealStatus Status,
        DateTime CreatedAt,
        DateTime? ClosedAt);
}
