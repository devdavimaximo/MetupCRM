using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Application.Deals.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Deals.Queries.ListDeals;

public class ListDealsQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService)
    : IRequestHandler<ListDealsQuery, PagedResult<DealListItemDto>>
{
    public async Task<PagedResult<DealListItemDto>> Handle(
        ListDealsQuery request,
        CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var query = context.Deals
            .AsNoTracking()
            .Where(d => d.OrganizationId == organizationId);

        if (request.Stage is { } stage)
        {
            query = query.Where(d => d.Stage == stage);
        }

        if (request.OwnerUserId is { } ownerUserId)
        {
            query = query.Where(d => d.OwnerUserId == ownerUserId);
        }

        if (request.Source is { } source)
        {
            query = query.Where(d => d.Source == source);
        }

        if (request.CompanyId is { } companyId)
        {
            query = query.Where(d => d.CompanyId == companyId);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(d => d.CreatedAt)
            .ThenBy(d => d.Id)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListItemDto(context)
            .ToListAsync(cancellationToken);

        return new PagedResult<DealListItemDto>(items, request.Page, request.PageSize, totalCount);
    }
}
