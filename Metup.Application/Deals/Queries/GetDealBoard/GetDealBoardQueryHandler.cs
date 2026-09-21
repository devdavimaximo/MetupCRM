using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Application.Deals.Common;
using Metup.Domain.Deals;
using MediatR;

namespace Metup.Application.Deals.Queries.GetDealBoard;

/// <summary>
/// O quadro inteiro numa chamada: totais das sete etapas ativas num <c>GROUP BY</c> (fotografia do
/// agora, sem período), totais de ganhos e perdidos no período, e a primeira página de cada coluna.
/// São 3 consultas de totais e 9 de amostra (uma por coluna), cada uma servida por índice.
/// </summary>
public class GetDealBoardQueryHandler(
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock,
    DealBoardReader reader) : IRequestHandler<GetDealBoardQuery, DealBoardDto>
{
    public async Task<DealBoardDto> Handle(GetDealBoardQuery request, CancellationToken cancellationToken)
    {
        var scope = currentUserService.ResolveDealOwnerScope(request.Filter.OwnerUserId, request.Filter.AllOwners);
        var clock = await organizationClock.SnapshotAsync(cancellationToken);
        var period = LocalPeriod.Resolve(request.From, request.To, clock.Today, DealBoardReader.DefaultPeriodDays);
        var boardClock = await reader.BoardClockAsync(scope.OrganizationId, clock, cancellationToken);

        var deals = reader.Filtered(scope, request.Filter, boardClock);
        var openTotals = await DealBoardReader.OpenTotalsAsync(deals, cancellationToken);

        var columns = new List<DealBoardColumnDto>(DealBoardReader.ActiveStages.Count);
        foreach (var stage in DealBoardReader.ActiveStages)
        {
            columns.Add(await reader.ReadColumnAsync(
                stage,
                DealBoardReader.OpenInStage(deals, stage),
                openTotals.GetValueOrDefault(stage, ColumnTotals.Empty),
                request.Sort,
                page: 1,
                request.PerColumn,
                boardClock,
                cancellationToken));
        }

        async Task<DealBoardColumnDto> ClosedColumn(DealStatus status, DealStage stage)
        {
            var closed = DealBoardReader.ClosedInPeriod(deals, status, period, clock);
            var totals = await DealBoardReader.ClosedTotalsAsync(closed, cancellationToken);
            return await reader.ReadColumnAsync(stage, closed, totals, request.Sort, 1, request.PerColumn, boardClock, cancellationToken);
        }

        var won = await ClosedColumn(DealStatus.Ganho, DealStage.Ganho);
        var lost = await ClosedColumn(DealStatus.Perdido, DealStage.Perdido);

        return new DealBoardDto(
            scope.OwnerUserId,
            period.StartLocal,
            period.EndLocal,
            request.Sort,
            columns,
            new DealBoardClosedDto(won, lost));
    }
}
