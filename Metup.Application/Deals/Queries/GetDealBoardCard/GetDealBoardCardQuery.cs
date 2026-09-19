using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Deals.Common;
using MediatR;

namespace Metup.Application.Deals.Queries.GetDealBoardCard;

/// <summary>
/// Um cartão do quadro, para trocar só ele depois de uma ação (<c>?view=card</c>). Mesmo acesso da
/// ficha do negócio (<c>GetDealById</c>): a organização inteira.
/// </summary>
public record GetDealBoardCardQuery(Guid Id) : IRequest<DealBoardCardDto>;

public class GetDealBoardCardQueryHandler(
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock,
    IApplicationDbContext context,
    DealBoardReader reader) : IRequestHandler<GetDealBoardCardQuery, DealBoardCardDto>
{
    public async Task<DealBoardCardDto> Handle(GetDealBoardCardQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var clock = await organizationClock.SnapshotAsync(cancellationToken);
        var boardClock = await reader.BoardClockAsync(organizationId, clock, cancellationToken);

        var deal = context.Deals.Where(d => d.Id == request.Id && d.OrganizationId == organizationId);

        return await reader.ReadCardAsync(deal, boardClock, cancellationToken)
            ?? throw new NotFoundException("Negócio");
    }
}
