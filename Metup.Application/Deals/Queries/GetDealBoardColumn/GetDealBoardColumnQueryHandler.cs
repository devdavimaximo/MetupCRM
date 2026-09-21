using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Application.Deals.Common;
using Metup.Domain.Deals;
using MediatR;

namespace Metup.Application.Deals.Queries.GetDealBoardColumn;

public class GetDealBoardColumnQueryHandler(
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock,
    DealBoardReader reader) : IRequestHandler<GetDealBoardColumnQuery, DealBoardColumnDto>
{
    public async Task<DealBoardColumnDto> Handle(GetDealBoardColumnQuery request, CancellationToken cancellationToken)
    {
        var scope = currentUserService.ResolveDealOwnerScope(request.Filter.OwnerUserId, request.Filter.AllOwners);
        var clock = await organizationClock.SnapshotAsync(cancellationToken);
        var boardClock = await reader.BoardClockAsync(scope.OrganizationId, clock, cancellationToken);
        var deals = reader.Filtered(scope, request.Filter, boardClock);

        if (request.Closed is { } group)
        {
            var period = LocalPeriod.Resolve(request.From, request.To, clock.Today, DealBoardReader.DefaultPeriodDays);
            var (status, closedStage) = group == DealBoardClosedGroup.Won
                ? (DealStatus.Ganho, DealStage.Ganho)
                : (DealStatus.Perdido, DealStage.Perdido);

            var closed = DealBoardReader.ClosedInPeriod(deals, status, period, clock);
            var closedTotals = await DealBoardReader.ClosedTotalsAsync(closed, cancellationToken);
            return await reader.ReadColumnAsync(
                closedStage, closed, closedTotals, request.Sort, request.Page, request.PerColumn, boardClock, cancellationToken);
        }

        var stage = request.Stage!.Value;
        var openTotals = await DealBoardReader.OpenTotalsAsync(DealBoardReader.OpenInStage(deals, stage), cancellationToken);

        return await reader.ReadColumnAsync(
            stage,
            DealBoardReader.OpenInStage(deals, stage),
            openTotals.GetValueOrDefault(stage, ColumnTotals.Empty),
            request.Sort,
            request.Page,
            request.PerColumn,
            boardClock,
            cancellationToken);
    }
}
