using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Deals.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Deals.Queries.GetDealById;

public class GetDealByIdQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetDealByIdQuery, DealDto>
{
    public async Task<DealDto> Handle(GetDealByIdQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var deal = await context.Deals
            .AsNoTracking()
            .Where(d => d.Id == request.Id && d.OrganizationId == organizationId)
            .ToDealDto(context)
            .FirstOrDefaultAsync(cancellationToken);

        return deal ?? throw new NotFoundException("Negócio");
    }
}
