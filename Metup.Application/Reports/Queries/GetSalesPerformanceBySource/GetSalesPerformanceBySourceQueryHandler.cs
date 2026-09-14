using Metup.Application.Common.Interfaces;
using Metup.Application.Reports.Common;
using Metup.Domain.Deals;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Reports.Queries.GetSalesPerformanceBySource;

/// <summary>
/// Conversão e ticket médio por origem do negócio (V3, terceira fatia — seção 7 do CLAUDE.md): para
/// cada <see cref="DealSource"/>, quantos negócios estão abertos/ganhos/perdidos, a taxa de
/// fechamento e o ticket médio, calculados direto de Deal.Status e Deal.Amount (enum + decimal,
/// nunca texto ou float). O período (quando informado) escopa tudo por Deal.CreatedAt. GroupKey e
/// GroupLabel saem como o nome do enum — a tradução para pt-br (seção 8) é feita na UI, junto com o
/// mapeamento de DealSource já existente para o Pipeline.
/// </summary>
public class GetSalesPerformanceBySourceQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetSalesPerformanceBySourceQuery, SalesPerformanceReportDto>
{
    public async Task<SalesPerformanceReportDto> Handle(GetSalesPerformanceBySourceQuery request, CancellationToken cancellationToken)
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
            .GroupBy(d => d.Source)
            .Select(g => new
            {
                Source = g.Key,
                OpenDeals = g.Count(d => d.Status == DealStatus.Aberto),
                WonDeals = g.Count(d => d.Status == DealStatus.Ganho),
                LostDeals = g.Count(d => d.Status == DealStatus.Perdido),
                TotalRevenue = g.Where(d => d.Status == DealStatus.Ganho).Sum(d => (decimal?)d.Amount) ?? 0m,
                AverageTicket = g.Where(d => d.Status == DealStatus.Ganho).Average(d => (decimal?)d.Amount),
            })
            .ToListAsync(cancellationToken);

        var groups = stats
            .OrderBy(s => (int)s.Source)
            .Select(s => new SalesPerformanceGroupDto(
                s.Source.ToString(),
                s.Source.ToString(),
                s.OpenDeals,
                s.WonDeals,
                s.LostDeals,
                s.WonDeals + s.LostDeals > 0 ? (decimal)s.WonDeals / (s.WonDeals + s.LostDeals) : (decimal?)null,
                s.AverageTicket,
                s.TotalRevenue))
            .ToList();

        return new SalesPerformanceReportDto(groups);
    }
}
