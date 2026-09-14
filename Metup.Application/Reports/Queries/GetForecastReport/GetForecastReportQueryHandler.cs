using Metup.Application.Common.Interfaces;
using Metup.Application.Reports.Common;
using Metup.Domain.Deals;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Reports.Queries.GetForecastReport;

/// <summary>
/// Forecast / receita potencial (V3, sexta fatia — seção 7 do CLAUDE.md): diferente dos demais
/// relatórios, que olham para negócios já fechados, este olha para o pipeline aberto e pondera
/// cada estágio pela sua probabilidade histórica de virar Ganho.
///
/// A probabilidade por estágio vem do histórico real de StageChange — nunca de uma tabela fixa
/// inventada (regra "não invente probabilidade sem base"): para cada estágio, olhamos todos os
/// negócios que em algum momento passaram por ele (StageChange.ToStage) e já fecharam (Ganho ou
/// Perdido); a probabilidade é a fração que fechou como Ganho. Quando não há negócios fechados
/// que passaram por um estágio, a probabilidade fica <c>null</c> e esse estágio não contribui
/// para o forecast ponderado — melhor não ponderar do que inventar um número.
/// </summary>
public class GetForecastReportQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetForecastReportQuery, ForecastReportDto>
{
    public async Task<ForecastReportDto> Handle(GetForecastReportQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var openDeals = context.Deals
            .AsNoTracking()
            .Where(d => d.OrganizationId == organizationId && d.Status == DealStatus.Aberto);

        if (request.From.HasValue)
        {
            openDeals = openDeals.Where(d => d.CreatedAt >= request.From.Value);
        }

        if (request.To.HasValue)
        {
            openDeals = openDeals.Where(d => d.CreatedAt <= request.To.Value);
        }

        var pipelineByStage = await openDeals
            .GroupBy(d => d.Stage)
            .Select(g => new { Stage = g.Key, Count = g.Count(), Amount = g.Sum(d => d.Amount ?? 0m) })
            .ToListAsync(cancellationToken);

        // Probabilidade histórica por estágio: independe do período do request, que só escopa o
        // pipeline aberto — a amostra de negócios fechados usa todo o histórico da organização,
        // para não perder representatividade estatística.
        var closedDealStatusById = await context.Deals
            .AsNoTracking()
            .Where(d => d.OrganizationId == organizationId && d.Status != DealStatus.Aberto)
            .Select(d => new { d.Id, d.Status })
            .ToDictionaryAsync(d => d.Id, d => d.Status, cancellationToken);

        var stageReaches = await context.StageChanges
            .AsNoTracking()
            .Where(sc => sc.OrganizationId == organizationId)
            .Select(sc => new { sc.DealId, sc.ToStage })
            .ToListAsync(cancellationToken);

        var winProbabilityByStage = stageReaches
            .GroupBy(sc => sc.ToStage)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var closedDealIds = g.Select(sc => sc.DealId).Distinct()
                        .Where(closedDealStatusById.ContainsKey)
                        .ToList();

                    if (closedDealIds.Count == 0)
                    {
                        return (decimal?)null;
                    }

                    var wonCount = closedDealIds.Count(id => closedDealStatusById[id] == DealStatus.Ganho);
                    return (decimal?)wonCount / closedDealIds.Count;
                });

        var byStage = pipelineByStage
            .Select(p =>
            {
                var winProbability = winProbabilityByStage.GetValueOrDefault(p.Stage);
                var weightedAmount = winProbability.HasValue ? p.Amount * winProbability.Value : (decimal?)null;
                return new ForecastByStageDto(p.Stage, p.Count, p.Amount, winProbability, weightedAmount);
            })
            .OrderBy(d => d.Stage)
            .ToList();

        return new ForecastReportDto(
            byStage,
            byStage.Sum(d => d.OpenDealsCount),
            byStage.Sum(d => d.OpenAmount),
            byStage.Sum(d => d.WeightedAmount ?? 0m));
    }
}
