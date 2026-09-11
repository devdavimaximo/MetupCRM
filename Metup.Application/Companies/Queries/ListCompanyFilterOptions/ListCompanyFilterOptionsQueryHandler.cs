using Metup.Application.Common.Interfaces;
using Metup.Application.Companies.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Companies.Queries.ListCompanyFilterOptions;

public class ListCompanyFilterOptionsQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService)
    : IRequestHandler<ListCompanyFilterOptionsQuery, CompanyFilterOptionsDto>
{
    public async Task<CompanyFilterOptionsDto> Handle(
        ListCompanyFilterOptionsQuery request,
        CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var companies = context.Companies
            .AsNoTracking()
            .Where(c => c.OrganizationId == organizationId);

        var segments = await companies
            .Where(c => c.Segment != null)
            .Select(c => c.Segment!)
            .Distinct()
            .OrderBy(s => s)
            .ToListAsync(cancellationToken);

        var cities = await companies
            .Where(c => c.City != null)
            .Select(c => c.City!)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync(cancellationToken);

        return new CompanyFilterOptionsDto(segments, cities);
    }
}
