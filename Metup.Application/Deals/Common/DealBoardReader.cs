using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Application.Deals.Analytics;
using Metup.Domain.Activities;
using Metup.Domain.Deals;
using Metup.Domain.Organizations;
using Metup.Domain.Tasks;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Deals.Common;

/// <summary>
/// Leitura do quadro do pipeline, compartilhada pelo quadro inteiro, pela coluna paginada, pelo
/// cartão avulso e pelo resumo: os filtros, a projeção do cartão (uma consulta, com subconsultas
/// correlacionadas para última transição, última atividade e próxima tarefa — sem N+1) e os totais
/// por coluna, sempre agregados no banco.
/// </summary>
public class DealBoardReader(IApplicationDbContext context, ITextSearch textSearch)
{
    public const int DefaultPerColumn = 20;
    public const int MaxPerColumn = 50;

    /// <summary>
    /// Teto da coluna paginada (<c>board/column</c>), maior que o da amostra do quadro: a lista
    /// lateral "Ver todos" pagina de 25 ou 50 e precisa de folga (item 16 da PL3).
    /// </summary>
    public const int MaxColumnPageSize = 100;
    public const int DefaultPeriodDays = 30;

    /// <summary>As colunas ativas do quadro, na ordem do funil (com Proposta — regra 4.2).</summary>
    public static readonly IReadOnlyList<DealStage> ActiveStages =
    [
        DealStage.Prospect,
        DealStage.PrimeiroContato,
        DealStage.ContatoRealizado,
        DealStage.Qualificacao,
        DealStage.Reuniao,
        DealStage.Proposta,
        DealStage.Negociacao,
    ];

    /// <summary>
    /// Negócios da organização no escopo resolvido, com origem, segmento e busca aplicados.
    /// <paramref name="boardClock"/> só é necessário para <c>StalledOnly</c> (o limite de parado da
    /// organização); sem ele, o filtro de parados é ignorado.
    /// </summary>
    public IQueryable<Deal> Filtered(DealScopeFilter scope, DealPipelineFilter filter, BoardClock? boardClock = null)
    {
        var deals = context.Deals.AsNoTracking().Where(d => d.OrganizationId == scope.OrganizationId);

        if (scope.OwnerUserId is { } ownerUserId)
        {
            deals = deals.Where(d => d.OwnerUserId == ownerUserId);
        }

        if (filter.Sources is { Count: > 0 } sources)
        {
            deals = deals.Where(d => sources.Contains(d.Source));
        }

        if (filter.Segments is { Count: > 0 } segments)
        {
            var companyIds = context.Companies
                .Where(c => c.OrganizationId == scope.OrganizationId && c.Segment != null && segments.Contains(c.Segment))
                .Select(c => c.Id);
            deals = deals.Where(d => companyIds.Contains(d.CompanyId));
        }

        if (filter.Search?.Trim() is { Length: > 0 } term)
        {
            // Subconsultas, nunca a lista de ids em memória (mesmo padrão da busca global).
            var companyIds = textSearch
                .WhereAnyContains(context.Companies.Where(c => c.OrganizationId == scope.OrganizationId), term, c => c.Name)
                .Select(c => c.Id);
            var contactIds = textSearch
                .WhereAnyContains(context.Contacts.Where(c => c.OrganizationId == scope.OrganizationId), term, c => c.Name)
                .Select(c => (Guid?)c.Id);
            deals = deals.Where(d => companyIds.Contains(d.CompanyId) || contactIds.Contains(d.ContactId));
        }

        if (filter.StalledOnly && boardClock is { } clock)
        {
            // Mesma conta de StalledDealRule, em forma de corte: entrou na etapa antes do limite.
            var stalledBefore = StalledDealRule.StalledBefore(clock.UtcNow, clock.StalledDealDays);
            deals = deals.Where(d =>
                d.Status == DealStatus.Aberto
                && (context.StageChanges.Where(sc => sc.DealId == d.Id).Max(sc => (DateTime?)sc.ChangedAt) ?? d.CreatedAt)
                    <= stalledBefore);
        }

        return deals;
    }

    /// <summary>Negócios fechados (ganhos ou perdidos, conforme <paramref name="status"/>) com <c>ClosedAt</c> no período local.</summary>
    public static IQueryable<Deal> ClosedInPeriod(
        IQueryable<Deal> deals,
        DealStatus status,
        LocalPeriod period,
        OrganizationClockSnapshot clock)
    {
        var start = clock.StartOfDayUtc(period.StartLocal);
        var end = clock.EndOfDayUtc(period.EndLocal);
        return deals.Where(d => d.Status == status && d.ClosedAt >= start && d.ClosedAt <= end);
    }

    public static IQueryable<Deal> OpenInStage(IQueryable<Deal> deals, DealStage stage) =>
        deals.Where(d => d.Status == DealStatus.Aberto && d.Stage == stage);

    /// <summary>Contagem, soma do valor efetivo e se há estimado, por etapa, dos abertos — um <c>GROUP BY</c>.</summary>
    public static async Task<IReadOnlyDictionary<DealStage, ColumnTotals>> OpenTotalsAsync(
        IQueryable<Deal> deals,
        CancellationToken cancellationToken)
    {
        var rows = await deals
            .Where(d => d.Status == DealStatus.Aberto)
            .Select(DealValue.Project((d, value, estimated) => new { d.Stage, Value = value, Estimated = estimated }))
            .GroupBy(r => r.Stage)
            .Select(g => new { Stage = g.Key, Count = g.Count(), Total = g.Sum(r => r.Value ?? 0m), Estimated = g.Count(r => r.Estimated) })
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(r => r.Stage, r => new ColumnTotals(r.Count, r.Total, r.Estimated > 0));
    }

    /// <summary>Contagem e soma do valor fechado — fechado nunca é estimado (<see cref="DealValue.ForStatus"/>).</summary>
    public static async Task<ColumnTotals> ClosedTotalsAsync(IQueryable<Deal> closedDeals, CancellationToken cancellationToken)
    {
        // O conjunto já vem de uma situação só (ClosedInPeriod), então o agrupamento dá uma linha.
        var totals = await closedDeals
            .GroupBy(d => d.Status)
            .Select(g => new { Count = g.Count(), Total = g.Sum(d => d.Amount ?? 0m) })
            .FirstOrDefaultAsync(cancellationToken);

        return totals is null ? ColumnTotals.Empty : new ColumnTotals(totals.Count, totals.Total, false);
    }

    /// <summary>
    /// Uma página da coluna. Abertos seguem <paramref name="sort"/>; fechados, o fechamento mais
    /// recente primeiro (o critério do quadro não faz sentido para quem já saiu do funil).
    /// </summary>
    public async Task<DealBoardColumnDto> ReadColumnAsync(
        DealStage stage,
        IQueryable<Deal> columnDeals,
        ColumnTotals totals,
        DealBoardSort sort,
        int page,
        int perColumn,
        BoardClock boardClock,
        CancellationToken cancellationToken)
    {
        var rows = ToCardRows(columnDeals);
        var ordered = stage is DealStage.Ganho or DealStage.Perdido
            ? rows.OrderByDescending(r => r.ClosedAt).ThenBy(r => r.Id)
            : Order(rows, sort);

        var items = await ordered
            .Skip((page - 1) * perColumn)
            .Take(perColumn)
            .ToListAsync(cancellationToken);

        return new DealBoardColumnDto(
            stage,
            totals.Count,
            totals.Total,
            totals.HasEstimate,
            page,
            items.Select(boardClock.ToCard).ToList(),
            totals.Count > page * perColumn);
    }

    public async Task<DealBoardCardDto?> ReadCardAsync(IQueryable<Deal> deal, BoardClock boardClock, CancellationToken cancellationToken)
    {
        var row = await ToCardRows(deal).FirstOrDefaultAsync(cancellationToken);
        return row is null ? null : boardClock.ToCard(row);
    }

    /// <summary>O relógio da organização e o limite de "parado" — o que o cartão precisa para derivar tempo na etapa, parado e atraso.</summary>
    public async Task<BoardClock> BoardClockAsync(Guid organizationId, OrganizationClockSnapshot clock, CancellationToken cancellationToken)
    {
        var stalledDealDays = await context.Organizations
            .AsNoTracking()
            .Where(o => o.Id == organizationId)
            .Select(o => (int?)o.StalledDealDays)
            .FirstOrDefaultAsync(cancellationToken) ?? Organization.DefaultStalledDealDays;

        return new BoardClock(clock.UtcNow, stalledDealDays);
    }

    public static IOrderedQueryable<DealCardRow> Order(IQueryable<DealCardRow> rows, DealBoardSort sort) => sort switch
    {
        DealBoardSort.ValueDesc => rows.OrderBy(r => r.Value == null).ThenByDescending(r => r.Value).ThenBy(r => r.Id),
        DealBoardSort.Recent => rows.OrderByDescending(r => r.CreatedAt).ThenBy(r => r.Id),
        DealBoardSort.ExpectedClose => rows.OrderBy(r => r.ExpectedCloseDate == null).ThenBy(r => r.ExpectedCloseDate).ThenBy(r => r.Id),
        _ => rows.OrderBy(r => r.StageEnteredAt).ThenBy(r => r.Id),
    };

    /// <summary>A projeção única do cartão. Valor pela regra de <see cref="DealValue"/>, conforme a situação.</summary>
    public IQueryable<DealCardRow> ToCardRows(IQueryable<Deal> deals) =>
        deals.Select(DealValue.Project((d, value, estimated) => new DealCardRow
        {
            Id = d.Id,
            CompanyId = d.CompanyId,
            CompanyName = context.Companies.Where(c => c.Id == d.CompanyId).Select(c => c.Name).First(),
            CompanySegment = context.Companies.Where(c => c.Id == d.CompanyId).Select(c => c.Segment).FirstOrDefault(),
            ContactName = d.ContactId == null
                ? null
                : context.Contacts.Where(c => c.Id == d.ContactId).Select(c => c.Name).FirstOrDefault(),
            Stage = d.Stage,
            Status = d.Status,
            Source = d.Source,
            OwnerUserId = d.OwnerUserId,
            OwnerUserName = context.Users.Where(u => u.Id == d.OwnerUserId).Select(u => u.Name).First(),
            Value = d.Status == DealStatus.Aberto ? value : d.Amount,
            ValueIsEstimated = d.Status == DealStatus.Aberto && estimated,
            StageEnteredAt = context.StageChanges
                .Where(sc => sc.DealId == d.Id)
                .Max(sc => (DateTime?)sc.ChangedAt) ?? d.CreatedAt,
            LastActivityAt = context.Activities
                .Where(a => a.DealId == d.Id)
                .Max(a => (DateTime?)a.OccurredAt),
            NextTaskType = context.Tasks
                .Where(t => t.DealId == d.Id && t.Status == TaskItemStatus.Pendente)
                .OrderBy(t => t.DueDate)
                .ThenBy(t => t.Id)
                .Select(t => (ActivityType?)t.Type)
                .FirstOrDefault(),
            NextTaskDueDate = context.Tasks
                .Where(t => t.DealId == d.Id && t.Status == TaskItemStatus.Pendente)
                .OrderBy(t => t.DueDate)
                .ThenBy(t => t.Id)
                .Select(t => (DateTime?)t.DueDate)
                .FirstOrDefault(),
            ExpectedCloseDate = d.ExpectedCloseDate,
            CreatedAt = d.CreatedAt,
            ClosedAt = d.ClosedAt,
            LostReason = d.LostReason,
        }));
}

public readonly record struct ColumnTotals(int Count, decimal Total, bool HasEstimate)
{
    public static readonly ColumnTotals Empty = new(0, 0m, false);
}

/// <summary>"Agora" e limite de parado da organização, para derivar os campos de tempo do cartão.</summary>
public sealed record BoardClock(DateTime UtcNow, int StalledDealDays)
{
    public DealBoardCardDto ToCard(DealCardRow row)
    {
        var isOpen = row.Status == DealStatus.Aberto;
        var nextTask = row is { NextTaskType: { } type, NextTaskDueDate: { } dueDate }
            ? new DealBoardNextTaskDto(type, dueDate, dueDate < UtcNow)
            : null;

        return new DealBoardCardDto(
            row.Id,
            row.CompanyId,
            row.CompanyName,
            row.CompanySegment,
            row.ContactName,
            row.Stage,
            row.Status,
            row.Source,
            row.OwnerUserId,
            row.OwnerUserName,
            row.Value,
            row.ValueIsEstimated,
            row.StageEnteredAt,
            StalledDealRule.DaysInStage(row.StageEnteredAt, UtcNow),
            isOpen && StalledDealRule.IsStalled(row.StageEnteredAt, UtcNow, StalledDealDays),
            row.LastActivityAt,
            nextTask,
            row.ExpectedCloseDate,
            row.ClosedAt,
            row.LostReason);
    }
}

/// <summary>Linha plana do cartão, lida do banco; os campos derivados de "agora" saem em <see cref="BoardClock.ToCard"/>.</summary>
public sealed class DealCardRow
{
    public Guid Id { get; init; }
    public Guid CompanyId { get; init; }
    public string CompanyName { get; init; } = string.Empty;
    public string? CompanySegment { get; init; }
    public string? ContactName { get; init; }
    public DealStage Stage { get; init; }
    public DealStatus Status { get; init; }
    public DealSource Source { get; init; }
    public Guid OwnerUserId { get; init; }
    public string OwnerUserName { get; init; } = string.Empty;
    public decimal? Value { get; init; }
    public bool ValueIsEstimated { get; init; }
    public DateTime StageEnteredAt { get; init; }
    public DateTime? LastActivityAt { get; init; }
    public ActivityType? NextTaskType { get; init; }
    public DateTime? NextTaskDueDate { get; init; }
    public DateOnly? ExpectedCloseDate { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? ClosedAt { get; init; }
    public LostReason? LostReason { get; init; }
}
