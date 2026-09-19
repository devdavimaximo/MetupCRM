using Metup.Application.Common.Interfaces;
using Metup.Domain.Deals;

namespace Metup.Application.Deals.Common;

/// <summary>
/// Um negócio como ele estava num instante passado: se já existia e estava aberto, em que etapa e com
/// que valor. Reconstruído de StageChange (etapa) e DealValueChange (valor) — a base do "anterior", das
/// sparklines e da evolução do pipeline.
/// </summary>
public sealed class DealAtInstant
{
    public Guid Id { get; init; }

    public DateTime CreatedAt { get; init; }

    /// <summary>Já existia e ainda não tinha fechado no instante.</summary>
    public bool IsOpen { get; init; }

    public DealStage Stage { get; init; }

    public decimal? Amount { get; init; }

    public decimal? Ticket { get; init; }
}

public static class DealAtInstantQueries
{
    /// <summary>
    /// Traduz para subconsultas correlacionadas (uma ida ao banco). Valor vigente em T, campo a campo:
    /// o <c>To*</c> da última mudança com <c>ChangedAt ≤ T</c>; sem mudança até T, o <c>From*</c> da
    /// primeira mudança depois de T; sem mudança nenhuma, o valor atual.
    ///
    /// Aproximação: valores alterados antes de existir o histórico (migration <c>AddDealValueChangesAndLostReason</c>)
    /// não deixaram rastro, e o negócio aparece com o valor seguinte (ou o atual) também no passado.
    /// </summary>
    public static IQueryable<DealAtInstant> AtInstant(
        this IQueryable<Deal> deals,
        IApplicationDbContext context,
        DateTime instantUtc) =>
        deals.Select(d => new DealAtInstant
        {
            Id = d.Id,
            CreatedAt = d.CreatedAt,
            IsOpen = d.CreatedAt <= instantUtc && (d.ClosedAt == null || d.ClosedAt > instantUtc),
            Stage = context.StageChanges
                .Where(sc => sc.DealId == d.Id && sc.ChangedAt <= instantUtc)
                .OrderByDescending(sc => sc.ChangedAt)
                .Select(sc => (DealStage?)sc.ToStage)
                .FirstOrDefault() ?? d.Stage,
            Amount = context.DealValueChanges.Any(v => v.OrganizationId == d.OrganizationId && v.DealId == d.Id && v.ChangedAt <= instantUtc)
                ? context.DealValueChanges
                    .Where(v => v.OrganizationId == d.OrganizationId && v.DealId == d.Id && v.ChangedAt <= instantUtc)
                    .OrderByDescending(v => v.ChangedAt)
                    .Select(v => v.ToAmount)
                    .FirstOrDefault()
                : context.DealValueChanges.Any(v => v.OrganizationId == d.OrganizationId && v.DealId == d.Id && v.ChangedAt > instantUtc)
                    ? context.DealValueChanges
                        .Where(v => v.OrganizationId == d.OrganizationId && v.DealId == d.Id && v.ChangedAt > instantUtc)
                        .OrderBy(v => v.ChangedAt)
                        .Select(v => v.FromAmount)
                        .FirstOrDefault()
                    : d.Amount,
            Ticket = context.DealValueChanges.Any(v => v.OrganizationId == d.OrganizationId && v.DealId == d.Id && v.ChangedAt <= instantUtc)
                ? context.DealValueChanges
                    .Where(v => v.OrganizationId == d.OrganizationId && v.DealId == d.Id && v.ChangedAt <= instantUtc)
                    .OrderByDescending(v => v.ChangedAt)
                    .Select(v => v.ToTicket)
                    .FirstOrDefault()
                : context.DealValueChanges.Any(v => v.OrganizationId == d.OrganizationId && v.DealId == d.Id && v.ChangedAt > instantUtc)
                    ? context.DealValueChanges
                        .Where(v => v.OrganizationId == d.OrganizationId && v.DealId == d.Id && v.ChangedAt > instantUtc)
                        .OrderBy(v => v.ChangedAt)
                        .Select(v => v.FromTicket)
                        .FirstOrDefault()
                    : d.Ticket,
        });
}
