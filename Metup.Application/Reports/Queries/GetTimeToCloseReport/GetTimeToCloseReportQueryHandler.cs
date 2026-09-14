using Metup.Application.Common.Interfaces;
using Metup.Application.Reports.Common;
using Metup.Domain.Deals;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Reports.Queries.GetTimeToCloseReport;

/// <summary>
/// Tempo até fechamento (V3, quarta fatia — seção 7 do CLAUDE.md): tempo médio, em dias, entre a
/// criação do negócio e o fechamento como ganho — ponta a ponta, não por estágio (isso já é
/// respondido por <c>GetFunnelReportQuery.AverageDaysInStage</c>, via StageChange). O período
/// (quando informado) escopa por Deal.CreatedAt, igual aos demais relatórios.
/// </summary>
public class GetTimeToCloseReportQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetTimeToCloseReportQuery, TimeToCloseReportDto>
{
    public async Task<TimeToCloseReportDto> Handle(GetTimeToCloseReportQuery request, CancellationToken cancellationToken)
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

        var wonDeals = await deals
            .Where(d => d.Status == DealStatus.Ganho && d.ClosedAt != null)
            .Select(d => new { d.CreatedAt, ClosedAt = d.ClosedAt!.Value })
            .ToListAsync(cancellationToken);

        var averageDaysToClose = wonDeals.Count > 0
            ? wonDeals.Average(d => (d.ClosedAt - d.CreatedAt).TotalDays)
            : (double?)null;

        return new TimeToCloseReportDto(wonDeals.Count, averageDaysToClose);
    }
}
