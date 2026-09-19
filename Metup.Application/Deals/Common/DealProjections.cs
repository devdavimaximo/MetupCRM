using Metup.Application.Common.Interfaces;
using Metup.Domain.Deals;

namespace Metup.Application.Deals.Common;

/// <summary>
/// Projeção compartilhada de Deal para DTO. Reaproveitada por queries e por commands que
/// devolvem a ficha atualizada após uma mutação, para não duplicar o mesmo Select cinco vezes.
/// </summary>
public static class DealProjections
{
    public static IQueryable<DealListItemDto> ToListItemDto(this IQueryable<Deal> deals, IApplicationDbContext context) =>
        deals.Select(d => new DealListItemDto(
            d.Id,
            d.CompanyId,
            context.Companies.Where(c => c.Id == d.CompanyId).Select(c => c.Name).First(),
            d.ContactId,
            d.ContactId == null
                ? null
                : context.Contacts.Where(c => c.Id == d.ContactId).Select(c => c.Name).FirstOrDefault(),
            d.Stage,
            d.Source,
            d.OwnerUserId,
            context.Users.Where(u => u.Id == d.OwnerUserId).Select(u => u.Name).First(),
            d.Ticket,
            d.Amount,
            d.ExpectedCloseDate,
            d.Status,
            d.CreatedAt,
            d.ClosedAt));

    public static IQueryable<DealDto> ToDealDto(this IQueryable<Deal> deals, IApplicationDbContext context) =>
        deals.Select(d => new DealDto(
            d.Id,
            d.CompanyId,
            context.Companies.Where(c => c.Id == d.CompanyId).Select(c => c.Name).First(),
            d.ContactId,
            d.ContactId == null
                ? null
                : context.Contacts.Where(c => c.Id == d.ContactId).Select(c => c.Name).FirstOrDefault(),
            d.Stage,
            d.Source,
            d.OwnerUserId,
            context.Users.Where(u => u.Id == d.OwnerUserId).Select(u => u.Name).First(),
            d.Ticket,
            d.Amount,
            d.ExpectedCloseDate,
            d.Status,
            d.CreatedAt,
            d.ClosedAt,
            d.StageChanges
                .OrderBy(sc => sc.ChangedAt)
                .Select(sc => new StageChangeDto(sc.Id, sc.FromStage, sc.ToStage, sc.ChangedAt, sc.ChangedByUserId))
                .ToList(),
            d.LostReason,
            d.LostNote));
}
