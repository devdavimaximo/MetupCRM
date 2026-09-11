using Metup.Application.Common.Extensions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Application.Companies.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Companies.Queries.ListCompanies;

public class ListCompaniesQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService)
    : IRequestHandler<ListCompaniesQuery, PagedResult<CompanyListItemDto>>
{
    public async Task<PagedResult<CompanyListItemDto>> Handle(
        ListCompaniesQuery request,
        CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var query = context.Companies
            .AsNoTracking()
            .Where(c => c.OrganizationId == organizationId);

        var search = request.Search.NormalizeOptional()?.ToLowerInvariant();
        if (search is not null)
        {
            query = query.Where(c =>
                c.Name.ToLower().Contains(search)
                || (c.Segment != null && c.Segment.ToLower().Contains(search))
                || (c.City != null && c.City.ToLower().Contains(search)));
        }

        var segment = request.Segment.NormalizeOptional()?.ToLowerInvariant();
        if (segment is not null)
        {
            query = query.Where(c => c.Segment != null && c.Segment.ToLower() == segment);
        }

        var city = request.City.NormalizeOptional()?.ToLowerInvariant();
        if (city is not null)
        {
            query = query.Where(c => c.City != null && c.City.ToLower() == city);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(c => c.Name)
            .ThenBy(c => c.Id)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(c => new CompanyListItemDto(
                c.Id,
                c.Name,
                c.Segment,
                c.City,
                c.Phone,
                c.Contacts.Count))
            .ToListAsync(cancellationToken);

        return new PagedResult<CompanyListItemDto>(items, request.Page, request.PageSize, totalCount);
    }
}
