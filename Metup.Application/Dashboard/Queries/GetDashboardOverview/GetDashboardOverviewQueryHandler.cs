using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Application.Dashboard.Common;
using Metup.Application.Deals.Analytics;
using Metup.Domain.Activities;
using Metup.Domain.Deals;
using Metup.Domain.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Dashboard.Queries.GetDashboardOverview;

/// <summary>
/// Tudo que o dashboard mostra é calculado de Deal, StageChange, Activity e TaskItem — nenhum
/// número sem base. O recorte de quem enxerga o quê vem de <c>ResolveDealScope</c> (ponto central),
/// e as janelas são dias inteiros no fuso da organização (<see cref="IOrganizationClock"/>).
///
/// Os negócios são lidos numa projeção enxuta e agregados em memória: no volume da V1 isso é
/// uma única ida ao banco e evita GroupBy/DateTrunc dependentes de provedor. Quando o volume
/// crescer, é a candidata natural a tabela de leitura (seção 7 do CLAUDE.md).
/// </summary>
public class GetDashboardOverviewQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock) : IRequestHandler<GetDashboardOverviewQuery, DashboardOverviewDto>
{
    private const int StalledAfterDays = 14;
    private const int FeaturedDealsLimit = 5;
    private const int RecentEventsLimit = 5;

    public async Task<DashboardOverviewDto> Handle(GetDashboardOverviewQuery request, CancellationToken cancellationToken)
    {
        var scope = currentUserService.ResolveDealScope(request.Scope);
        var clock = await organizationClock.SnapshotAsync(cancellationToken);

        // Dias inteiros no fuso da organização: a janela termina no fim do último dia local, para que
        // a venda das 23h caia no dia certo e não no seguinte.
        var window = PeriodWindow.Resolve(request, clock.Today);
        var periodStartLocal = window.StartLocal;
        var periodEndLocal = window.EndLocal;

        var periodStart = clock.StartOfDayUtc(periodStartLocal);
        var previousStart = clock.StartOfDayUtc(window.PreviousStartLocal);
        var periodEnd = clock.EndOfDayUtc(periodEndLocal);

        var deals = await ScopedDeals(scope)
            .Select(d => new DealRow(
                d.Id, d.CompanyId, d.Stage, d.Source, d.OwnerUserId, d.Amount, d.Ticket, d.Status, d.CreatedAt, d.ClosedAt))
            .ToListAsync(cancellationToken);

        var dealIds = deals.Select(d => d.Id).ToList();

        bool InPeriod(DateTime? at) => at >= periodStart && at <= periodEnd;
        bool InPrevious(DateTime? at) => at >= previousStart && at < periodStart;

        var won = deals.Where(d => d.Status == DealStatus.Ganho).ToList();
        var lost = deals.Where(d => d.Status == DealStatus.Perdido).ToList();
        var open = deals.Where(d => d.Status == DealStatus.Aberto).ToList();

        // Receita ganha continua sendo só Amount: valor fechado é o que foi de fato vendido.
        var revenue = new PeriodValueDto(
            won.Where(d => InPeriod(d.ClosedAt)).Sum(d => d.Amount ?? 0m),
            won.Where(d => InPrevious(d.ClosedAt)).Sum(d => d.Amount ?? 0m));

        var activityCounts = await ScopedActivities(scope, dealIds)
            .Where(a => a.OccurredAt >= previousStart && a.OccurredAt <= periodEnd)
            .GroupBy(a => new { a.Type, IsCurrent = a.OccurredAt >= periodStart })
            .Select(g => new { g.Key.Type, g.Key.IsCurrent, Count = g.Count() })
            .ToListAsync(cancellationToken);

        PeriodValueDto CountActivities(ActivityType type) => new(
            activityCounts.Where(a => a.Type == type && a.IsCurrent).Sum(a => a.Count),
            activityCounts.Where(a => a.Type == type && !a.IsCurrent).Sum(a => a.Count));

        var stageReaches = await ScopedStageChanges(scope, dealIds)
            .Select(sc => new StageReach(sc.DealId, sc.ToStage, sc.ChangedAt))
            .ToListAsync(cancellationToken);

        // Última transição de cada negócio = há quanto tempo ele está no estágio atual.
        var lastStageChangeByDeal = stageReaches
            .GroupBy(r => r.DealId)
            .ToDictionary(g => g.Key, g => g.Max(r => r.ChangedAt));

        int DaysInStage(DealRow deal) =>
            (int)(clock.UtcNow - lastStageChangeByDeal.GetValueOrDefault(deal.Id, deal.CreatedAt)).TotalDays;

        var pipeline = open
            .GroupBy(d => d.Stage)
            .Select(g => new PipelineStageDto(
                g.Key,
                g.Count(),
                g.Sum(d => d.EffectiveAmount ?? 0m),
                g.Count(d => d.IsEstimated),
                g.Count(d => DaysInStage(d) > StalledAfterDays)))
            .OrderBy(p => p.Stage)
            .ToList();

        var closedDealStatusById = deals
            .Where(d => d.Status != DealStatus.Aberto)
            .ToDictionary(d => d.Id, d => d.Status);

        var winProbabilityByStage = StageAnalytics.CalculateWinProbabilities(stageReaches, closedDealStatusById);

        // Receita prevista: fotografia do pipeline aberto ponderada pela probabilidade histórica de
        // cada etapa (mesma regra do relatório de forecast). Sem histórico não há previsão honesta.
        var weightedByStage = pipeline
            .Select(p => winProbabilityByStage.GetValueOrDefault(p.Stage) is { } probability
                ? p.Amount * probability
                : (decimal?)null)
            .ToList();

        var weightedForecast = weightedByStage.Any(w => w.HasValue)
            ? weightedByStage.Sum(w => w ?? 0m)
            : (decimal?)null;

        var stageAdvanceRates = StageAnalytics
            .CalculateAdvanceStats(stageReaches)
            .Select(s => new StageAdvanceRateDto(s.Stage, s.EnteredCount, s.AdvancedCount, s.AdvanceRate, s.AverageDaysInStage))
            .ToList();

        var companyNames = await context.Companies
            .AsNoTracking()
            .Where(c => c.OrganizationId == scope.OrganizationId)
            .ToDictionaryAsync(c => c.Id, c => c.Name, cancellationToken);

        var userNames = await context.Users
            .AsNoTracking()
            .Where(u => u.OrganizationId == scope.OrganizationId)
            .ToDictionaryAsync(u => u.Id, u => u.Name, cancellationToken);

        string CompanyOf(Guid companyId) => companyNames.GetValueOrDefault(companyId, "—");
        string UserOf(Guid userId) => userNames.GetValueOrDefault(userId, "—");

        var featured = open
            .Where(d => d.EffectiveAmount.HasValue)
            .OrderByDescending(d => d.EffectiveAmount)
            .ThenByDescending(d => d.Stage)
            .Take(FeaturedDealsLimit)
            .ToList();

        var featuredIds = featured.Select(d => d.Id).ToList();
        var nextTasks = (await context.Tasks
                .AsNoTracking()
                .Where(t => t.OrganizationId == scope.OrganizationId
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
                    d.Id, d.CompanyId, CompanyOf(d.CompanyId), d.Stage, d.EffectiveAmount, d.IsEstimated, UserOf(d.OwnerUserId),
                    DaysInStage(d), next?.DueDate, next?.Type);
            })
            .ToList();

        var dealById = deals.ToDictionary(d => d.Id);
        var recentEvents = await LoadRecentEventsAsync(scope, dealIds, dealById, CompanyOf, UserOf, cancellationToken);

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
                    openDeals.Count, openDeals.Sum(d => d.EffectiveAmount ?? 0m));
            })
            .Where(o => o.WonDeals > 0 || o.OpenDeals > 0)
            .OrderByDescending(o => o.Revenue)
            .ThenByDescending(o => o.OpenAmount)
            .ToList();

        var (series, granularity) = BuildRevenueSeries(won, lost, clock, periodStartLocal, periodEndLocal, window.Days);

        return new DashboardOverviewDto(
            window.Days,
            scope.AppliedScope,
            periodStart,
            periodEnd,
            previousStart,
            periodStartLocal,
            periodEndLocal,
            deals.Count == 0 ? null : deals.Min(d => d.CreatedAt),
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
            stageAdvanceRates,
            weightedForecast,
            open.Count(d => !d.EffectiveAmount.HasValue),
            StalledAfterDays,
            featuredDeals,
            recentEvents,
            sources,
            owners);
    }

    private IQueryable<Deal> ScopedDeals(DealScopeFilter scope)
    {
        var deals = context.Deals.AsNoTracking().Where(d => d.OrganizationId == scope.OrganizationId);
        return scope.OwnerUserId is { } ownerUserId ? deals.Where(d => d.OwnerUserId == ownerUserId) : deals;
    }

    /// <summary>Atividades e transições seguem o escopo pelo negócio a que pertencem, nunca pelo autor.</summary>
    private IQueryable<Activity> ScopedActivities(DealScopeFilter scope, IReadOnlyList<Guid> dealIds)
    {
        var activities = context.Activities.AsNoTracking().Where(a => a.OrganizationId == scope.OrganizationId);
        return scope.OwnerUserId is null ? activities : activities.Where(a => dealIds.Contains(a.DealId));
    }

    private IQueryable<StageChange> ScopedStageChanges(DealScopeFilter scope, IReadOnlyList<Guid> dealIds)
    {
        var stageChanges = context.StageChanges.AsNoTracking().Where(sc => sc.OrganizationId == scope.OrganizationId);
        return scope.OwnerUserId is null ? stageChanges : stageChanges.Where(sc => dealIds.Contains(sc.DealId));
    }

    /// <summary>
    /// Dias até ~31 pontos; acima disso, semanas — a série fica legível em qualquer período.
    /// Os buckets são datas locais da organização, e cada negócio cai no bucket do seu dia local.
    /// </summary>
    private static (IReadOnlyList<RevenuePointDto> Series, string Granularity) BuildRevenueSeries(
        IReadOnlyList<DealRow> won,
        IReadOnlyList<DealRow> lost,
        OrganizationClockSnapshot clock,
        DateOnly periodStartLocal,
        DateOnly periodEndLocal,
        int days)
    {
        var bucketDays = days <= 31 ? 1 : 7;
        var points = new List<RevenuePointDto>();

        for (var start = periodStartLocal; start <= periodEndLocal; start = start.AddDays(bucketDays))
        {
            var bucketStart = start;
            var bucketEnd = start.AddDays(bucketDays);
            bool InBucket(DealRow d)
            {
                if (d.ClosedAt is not { } closedAt)
                {
                    return false;
                }

                var closedLocal = clock.LocalDateOf(closedAt);
                return closedLocal >= bucketStart && closedLocal < bucketEnd;
            }

            var wonInBucket = won.Where(InBucket).ToList();
            points.Add(new RevenuePointDto(bucketStart, wonInBucket.Sum(d => d.Amount ?? 0m), wonInBucket.Count, lost.Count(InBucket)));
        }

        return (points, bucketDays == 1 ? "day" : "week");
    }

    private async Task<IReadOnlyList<RecentEventDto>> LoadRecentEventsAsync(
        DealScopeFilter scope,
        IReadOnlyList<Guid> dealIds,
        IReadOnlyDictionary<Guid, DealRow> dealById,
        Func<Guid, string> companyOf,
        Func<Guid, string> userOf,
        CancellationToken cancellationToken)
    {
        var activities = await ScopedActivities(scope, dealIds)
            .OrderByDescending(a => a.OccurredAt)
            .Take(RecentEventsLimit)
            .Select(a => new { a.DealId, a.Type, a.Outcome, a.AuthorUserId, a.OccurredAt })
            .ToListAsync(cancellationToken);

        var stageChanges = await ScopedStageChanges(scope, dealIds)
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

    /// <summary>
    /// Recorte do período em datas locais da organização: o intervalo pedido (From/To, inclusive) ou
    /// os últimos <c>Days</c> dias terminando hoje. A janela anterior tem a mesma quantidade de dias e
    /// termina no dia imediatamente antes do início.
    /// </summary>
    internal sealed record PeriodWindow(DateOnly StartLocal, DateOnly EndLocal)
    {
        public int Days => EndLocal.DayNumber - StartLocal.DayNumber + 1;

        public DateOnly PreviousStartLocal => StartLocal.AddDays(-Days);

        public static PeriodWindow Resolve(GetDashboardOverviewQuery request, DateOnly today) =>
            request is { From: { } from, To: { } to }
                ? new PeriodWindow(from, to)
                : new PeriodWindow(today.AddDays(-(request.Days - 1)), today);
    }

    /// <summary>
    /// Projeção enxuta do negócio. <see cref="EffectiveAmount"/> é o valor efetivo do negócio
    /// <b>aberto</b>: o valor em negociação ou, na falta dele, o ticket estimado — é o que o
    /// pipeline, os destaques e a receita prevista somam. Receita ganha nunca usa o ticket.
    /// </summary>
    private sealed record DealRow(
        Guid Id,
        Guid CompanyId,
        DealStage Stage,
        DealSource Source,
        Guid OwnerUserId,
        decimal? Amount,
        decimal? Ticket,
        DealStatus Status,
        DateTime CreatedAt,
        DateTime? ClosedAt)
    {
        public decimal? EffectiveAmount => Amount ?? Ticket;

        public bool IsEstimated => Amount is null && Ticket is not null;
    }
}
