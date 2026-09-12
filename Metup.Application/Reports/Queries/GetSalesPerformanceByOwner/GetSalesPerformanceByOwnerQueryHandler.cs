using Metup.Application.Common.Interfaces;
using Metup.Application.Reports.Common;
using Metup.Domain.Deals;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Reports.Queries.GetSalesPerformanceByOwner;

/// <summary>
/// Conversão e ticket médio por responsável (V3, segunda fatia — seção 7 do CLAUDE.md): para cada
/// dono de negócio, quantos negócios estão abertos/ganhos/perdidos, a taxa de fechamento e o
/// ticket médio, calculados direto de Deal.Status e Deal.Amount (enum + decimal, nunca texto ou
/// float). O período (quando informado) escopa tudo por Deal.CreatedAt.
/// </summary>
public class GetSalesPerformanceByOwnerQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetSalesPerformanceByOwnerQuery, SalesPerformanceReportDto>
{
    public async Task<SalesPerformanceReportDto> Handle(GetSalesPerformanceByOwnerQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var deals = context.Deals
            .AsNoTracking()
            .Where(d => d.OrganizationId == organizationId);

        if (request.From.HasValue)
        {
            deals = deals.Where(d => d.CreatedAt >= request.From.Value);
        }

        if (request.To.HasValue)
        {
            deals = deals.Where(d => d.CreatedAt <= request.To.Value);
        }

        var stats = await deals
            .GroupBy(d => d.OwnerUserId)
            .Select(g => new
            {
                OwnerUserId = g.Key,
                OpenDeals = g.Count(d => d.Status == DealStatus.Aberto),
                WonDeals = g.Count(d => d.Status == DealStatus.Ganho),
                LostDeals = g.Count(d => d.Status == DealStatus.Perdido),
                TotalRevenue = g.Where(d => d.Status == DealStatus.Ganho).Sum(d => (decimal?)d.Amount) ?? 0m,
                AverageTicket = g.Where(d => d.Status == DealStatus.Ganho).Average(d => (decimal?)d.Amount),
            })
            .ToListAsync(cancellationToken);

        var ownerIds = stats.Select(s => s.OwnerUserId).ToList();
        var ownerNames = await context.Users
            .AsNoTracking()
            .Where(u => ownerIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Name, cancellationToken);

        var byOwner = stats
            .Select(s => new SalesPerformanceByOwnerDto(
                s.OwnerUserId,
                ownerNames.GetValueOrDefault(s.OwnerUserId, "—"),
                s.OpenDeals,
                s.WonDeals,
                s.LostDeals,
                s.WonDeals + s.LostDeals > 0 ? (decimal)s.WonDeals / (s.WonDeals + s.LostDeals) : (decimal?)null,
                s.AverageTicket,
                s.TotalRevenue))
            .OrderBy(o => o.OwnerName)
            .ToList();

        return new SalesPerformanceReportDto(byOwner);
    }
}
