using System.Globalization;
using Metup.Application.Common.Interfaces;
using Metup.Application.Deals.Analytics;
using Metup.Application.Deals.Common;
using MediatR;

namespace Metup.Application.Deals.Queries.GetPipelineEvolution;

/// <summary>
/// Pipeline total e receita prevista no fim de cada mês local (o mês corrente é lido agora). Cada
/// ponto é a mesma fotografia do resumo (<see cref="PipelineSnapshots"/>): etapa vigente por
/// StageChange, valor vigente por DealValueChange. Duas aproximações, ditas no contrato: a
/// probabilidade de ganho é a de hoje, e negócio alterado antes do histórico de valor usa o valor
/// seguinte conhecido. Uma ida ao banco por mês.
/// </summary>
public class GetPipelineEvolutionQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock,
    DealBoardReader reader,
    IStageAnalyticsProvider stageAnalytics) : IRequestHandler<GetPipelineEvolutionQuery, PipelineEvolutionDto>
{
    public async Task<PipelineEvolutionDto> Handle(GetPipelineEvolutionQuery request, CancellationToken cancellationToken)
    {
        var scope = currentUserService.ResolveDealOwnerScope(request.Filter.OwnerUserId, request.Filter.AllOwners);
        var clock = await organizationClock.SnapshotAsync(cancellationToken);
        var deals = reader.Filtered(scope, request.Filter);
        var probabilities = (await stageAnalytics.GetAsync(scope, cancellationToken)).WinProbabilityByStage;

        var currentMonth = new DateOnly(clock.Today.Year, clock.Today.Month, 1);
        var points = new List<PipelineEvolutionPointDto>(request.Months);

        for (var offset = request.Months - 1; offset >= 0; offset--)
        {
            var monthStart = currentMonth.AddMonths(-offset);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);
            var isPartial = offset == 0;
            var at = isPartial ? clock.UtcNow : clock.EndOfDayUtc(monthEnd);

            var snapshot = await deals.PipelineAtAsync(context, at, probabilities, cancellationToken);
            points.Add(new PipelineEvolutionPointDto(
                monthStart.ToString("yyyy-MM", CultureInfo.InvariantCulture),
                monthEnd,
                isPartial,
                snapshot.PipelineTotal,
                snapshot.ForecastRevenue,
                snapshot.OpenDeals));
        }

        return new PipelineEvolutionDto(scope.OwnerUserId, points);
    }
}
