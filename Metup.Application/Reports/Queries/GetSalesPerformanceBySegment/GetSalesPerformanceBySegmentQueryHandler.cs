using Metup.Application.Common.Interfaces;
using Metup.Application.Reports.Common;
using Metup.Domain.Deals;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Reports.Queries.GetSalesPerformanceBySegment;

/// <summary>
/// Conversão e ticket médio por segmento de empresa (V3, terceira fatia — seção 7 do CLAUDE.md):
/// para cada segmento (Company.Segment), quantos negócios estão abertos/ganhos/perdidos, a taxa de
/// fechamento e o ticket médio, calculados direto de Deal.Status e Deal.Amount (enum + decimal,
/// nunca texto ou float). O período (quando informado) escopa tudo por Deal.CreatedAt.
/// </summary>
public class GetSalesPerformanceBySegmentQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetSalesPerformanceBySegmentQuery, SalesPerformanceReportDto>
{
    private const string NoSegmentLabel = "Sem segmento";

    public async Task<SalesPerformanceReportDto> Handle(GetSalesPerformanceBySegmentQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var deals =
            from d in context.Deals.AsNoTracking()
            join c in context.Companies.AsNoTracking() on d.CompanyId equals c.Id
            where d.OrganizationId == organizationId
            select new { Deal = d, c.Segment };

        if (request.From.HasValue)
        {
            deals = deals.Where(x => x.Deal.CreatedAt >= request.From.Value);
        }

        if (request.To.HasValue)
        {
            deals = deals.Where(x => x.Deal.CreatedAt <= request.To.Value);
        }

        var stats = await deals
            .GroupBy(x => x.Segment)
            .Select(g => new
            {
                Segment = g.Key,
                OpenDeals = g.Count(x => x.Deal.Status == DealStatus.Aberto),
                WonDeals = g.Count(x => x.Deal.Status == DealStatus.Ganho),
                LostDeals = g.Count(x => x.Deal.Status == DealStatus.Perdido),
                TotalRevenue = g.Where(x => x.Deal.Status == DealStatus.Ganho).Sum(x => (decimal?)x.Deal.Amount) ?? 0m,
                AverageTicket = g.Where(x => x.Deal.Status == DealStatus.Ganho).Average(x => (decimal?)x.Deal.Amount),
            })
            .ToListAsync(cancellationToken);

        var groups = stats
            .Select(s => new SalesPerformanceGroupDto(
                s.Segment ?? string.Empty,
                s.Segment ?? NoSegmentLabel,
                s.OpenDeals,
                s.WonDeals,
                s.LostDeals,
                s.WonDeals + s.LostDeals > 0 ? (decimal)s.WonDeals / (s.WonDeals + s.LostDeals) : (decimal?)null,
                s.AverageTicket,
                s.TotalRevenue))
            .OrderBy(g => g.GroupLabel)
            .ToList();

        return new SalesPerformanceReportDto(groups);
    }
}
