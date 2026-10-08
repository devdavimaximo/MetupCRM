using Metup.Application.Common.Interfaces;
using Metup.Domain.LeadFinder;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.LeadFinder.Common;

public static class LeadSearchProjections
{
    /// <summary>
    /// Lê as buscas já como DTO. "Sem resposta" depende do relógio, então é calculado depois de
    /// materializar, pela mesma regra do domínio (<see cref="LeadSearch.IsStalled"/>).
    /// </summary>
    public static async Task<List<LeadSearchDto>> ToDtoListAsync(
        this IQueryable<LeadSearch> searches,
        IApplicationDbContext context,
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
        var rows = await searches
            .Select(s => new
            {
                Search = s,
                RequestedByName = s.RequestedByUserId == null
                    ? null
                    : context.Users.Where(u => u.Id == s.RequestedByUserId).Select(u => u.Name).FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        return [.. rows.Select(r => r.Search.ToDto(r.RequestedByName, nowUtc))];
    }

    public static LeadSearchDto ToDto(this LeadSearch s, string? requestedByName, DateTime nowUtc) =>
        new(
            s.Id,
            s.Query,
            s.Location,
            s.MaxResults,
            s.WithoutWebsite,
            s.Status,
            s.Origin,
            s.RequestedByUserId,
            requestedByName,
            s.RequestedAt,
            s.StartedAt,
            s.FinishedAt,
            s.LastActivityAt,
            s.ReceivedCount,
            s.NewCount,
            s.ErrorMessage,
            s.IsStalled(nowUtc));

    public static async Task<LeadSearchDto> ToDtoAsync(
        this LeadSearch search,
        IApplicationDbContext context,
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
        var requestedByName = search.RequestedByUserId is { } userId
            ? await context.Users.Where(u => u.Id == userId).Select(u => u.Name).FirstOrDefaultAsync(cancellationToken)
            : null;

        return search.ToDto(requestedByName, nowUtc);
    }

    public static IQueryable<FoundLeadDto> ToDto(this IQueryable<FoundLead> leads) =>
        leads.Select(l => new FoundLeadDto(
            l.Id,
            l.LeadSearchId,
            l.Name,
            l.Category,
            l.Phone,
            l.Website,
            l.Email,
            l.Instagram,
            l.Address,
            l.City,
            l.State,
            l.Rating,
            l.ReviewCount,
            l.MapsUrl,
            l.Status,
            l.ExistingCompanyId,
            l.CompanyId,
            l.DealId,
            l.FoundAt));
}
