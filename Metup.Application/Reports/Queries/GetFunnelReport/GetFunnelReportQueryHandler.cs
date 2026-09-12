using Metup.Application.Common.Interfaces;
using Metup.Application.Reports.Common;
using Metup.Domain.Activities;
using Metup.Domain.Deals;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Reports.Queries.GetFunnelReport;

/// <summary>
/// Funil histórico completo (V3, primeira fatia — seção 7 do CLAUDE.md): contagem por estágio,
/// conversão estágio a estágio e tempo médio em cada estágio, tudo a partir de StageChange —
/// nunca do Stage atual do Deal, que só mostra o presente. Mais a métrica de ouro (ligações por
/// R$ 5.000). O período (quando informado) escopa tudo por Deal.CreatedAt.
/// </summary>
public class GetFunnelReportQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetFunnelReportQuery, FunnelReportDto>
{
    public async Task<FunnelReportDto> Handle(GetFunnelReportQuery request, CancellationToken cancellationToken)
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

        var dealsByStage = (await deals
            .GroupBy(d => d.Stage)
            .Select(g => new DealsByStageDto(g.Key, g.Count()))
            .ToListAsync(cancellationToken))
            .OrderBy(d => d.Stage)
            .ToList();

        var closedRevenue = await deals
            .Where(d => d.Status == DealStatus.Ganho)
            .SumAsync(d => d.Amount ?? 0m, cancellationToken);

        var callsCount = await context.Activities
            .AsNoTracking()
            .Where(a => a.OrganizationId == organizationId
                && a.Type == ActivityType.Call
                && deals.Select(d => d.Id).Contains(a.DealId))
            .CountAsync(cancellationToken);

        var callsPerFiveThousand = closedRevenue > 0
            ? callsCount / (closedRevenue / 5000m)
            : (decimal?)null;

        var stageChanges = await context.StageChanges
            .AsNoTracking()
            .Where(sc => sc.OrganizationId == organizationId && deals.Select(d => d.Id).Contains(sc.DealId))
            .OrderBy(sc => sc.DealId)
            .ThenBy(sc => sc.ChangedAt)
            .ToListAsync(cancellationToken);

        var stageConversions = stageChanges
            .Where(sc => sc.FromStage.HasValue)
            .GroupBy(sc => (From: sc.FromStage!.Value, sc.ToStage))
            .Select(g => new StageConversionDto(g.Key.From, g.Key.ToStage, g.Count()))
            .OrderBy(c => c.FromStage)
            .ThenBy(c => c.ToStage)
            .ToList();

        var daysInStage = new Dictionary<DealStage, List<double>>();
        foreach (var dealStageChanges in stageChanges.GroupBy(sc => sc.DealId))
        {
            var ordered = dealStageChanges.OrderBy(sc => sc.ChangedAt).ToList();
            for (var i = 0; i < ordered.Count - 1; i++)
            {
                var stage = ordered[i].ToStage;
                var days = (ordered[i + 1].ChangedAt - ordered[i].ChangedAt).TotalDays;

                if (!daysInStage.TryGetValue(stage, out var list))
                {
                    list = [];
                    daysInStage[stage] = list;
                }

                list.Add(days);
            }
        }

        var averageDaysInStage = daysInStage
            .Select(kv => new StageDurationDto(kv.Key, kv.Value.Average()))
            .OrderBy(d => d.Stage)
            .ToList();

        return new FunnelReportDto(
            dealsByStage,
            stageConversions,
            averageDaysInStage,
            new GoldenMetricDto(callsCount, closedRevenue, callsPerFiveThousand));
    }
}
