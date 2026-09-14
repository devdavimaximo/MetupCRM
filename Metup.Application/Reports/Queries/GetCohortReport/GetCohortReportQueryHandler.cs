using Metup.Application.Common.Interfaces;
using Metup.Application.Reports.Common;
using Metup.Domain.Deals;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Reports.Queries.GetCohortReport;

/// <summary>
/// Safras de negócios por mês de entrada no funil (V3, sétima fatia — seção 7 do CLAUDE.md):
/// diferente das quebras por responsável/segmento/origem, que cortam um período fixo por um eixo
/// fixo, aqui o corte é o próprio tempo — cada safra é o conjunto de negócios criados no mesmo mês
/// (Deal.CreatedAt), e o relatório acompanha como cada safra converteu e quão rápido, permitindo
/// comparar safras entre si. O período (quando informado) escopa quais negócios entram nas safras,
/// igual aos demais relatórios. Agrupamento feito em memória (como em
/// GetTimeToCloseReportQueryHandler) porque o corte por mês de Deal.CreatedAt não tem tradução
/// direta e estável para SQL via EF Core.
/// </summary>
public class GetCohortReportQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetCohortReportQuery, CohortReportDto>
{
    public async Task<CohortReportDto> Handle(GetCohortReportQuery request, CancellationToken cancellationToken)
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

        var dealData = await deals
            .Select(d => new
            {
                d.CreatedAt,
                d.Status,
                d.Amount,
                d.ClosedAt,
            })
            .ToListAsync(cancellationToken);

        var cohorts = dealData
            .GroupBy(d => new DateOnly(d.CreatedAt.Year, d.CreatedAt.Month, 1))
            .Select(g =>
            {
                var wonDeals = g.Where(d => d.Status == DealStatus.Ganho).ToList();
                var lostCount = g.Count(d => d.Status == DealStatus.Perdido);
                var openCount = g.Count(d => d.Status == DealStatus.Aberto);

                var daysToClose = wonDeals
                    .Where(d => d.ClosedAt.HasValue)
                    .Select(d => (d.ClosedAt!.Value - d.CreatedAt).TotalDays)
                    .ToList();

                return new CohortGroupDto(
                    g.Key.ToString("yyyy-MM"),
                    g.Count(),
                    openCount,
                    wonDeals.Count,
                    lostCount,
                    wonDeals.Count + lostCount > 0 ? (decimal)wonDeals.Count / (wonDeals.Count + lostCount) : (decimal?)null,
                    wonDeals.Count > 0 ? wonDeals.Average(d => (decimal?)d.Amount) : null,
                    wonDeals.Sum(d => d.Amount ?? 0m),
                    daysToClose.Count > 0 ? daysToClose.Average() : (double?)null);
            })
            .OrderBy(c => c.CohortKey)
            .ToList();

        return new CohortReportDto(cohorts);
    }
}
