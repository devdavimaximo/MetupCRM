using Metup.Application.Activities.Common;
using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Activities.Queries.ListActivitiesByDeal;

public class ListActivitiesByDealQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<ListActivitiesByDealQuery, IReadOnlyList<ActivityDto>>
{
    public async Task<IReadOnlyList<ActivityDto>> Handle(
        ListActivitiesByDealQuery request,
        CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var dealExists = await context.Deals
            .AnyAsync(d => d.Id == request.DealId && d.OrganizationId == organizationId, cancellationToken);
        if (!dealExists)
        {
            throw new NotFoundException("Negócio");
        }

        return await context.Activities
            .AsNoTracking()
            .Where(a => a.DealId == request.DealId && a.OrganizationId == organizationId)
            .OrderByDescending(a => a.OccurredAt)
            .ThenByDescending(a => a.CreatedAt)
            .ToActivityDto(context)
            .ToListAsync(cancellationToken);
    }
}
