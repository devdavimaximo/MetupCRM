using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Contacts.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Contacts.Queries.ListContactsByCompany;

public class ListContactsByCompanyQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService)
    : IRequestHandler<ListContactsByCompanyQuery, IReadOnlyList<ContactDto>>
{
    public async Task<IReadOnlyList<ContactDto>> Handle(
        ListContactsByCompanyQuery request,
        CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var companyExists = await context.Companies
            .AnyAsync(
                c => c.Id == request.CompanyId && c.OrganizationId == organizationId,
                cancellationToken);

        if (!companyExists)
        {
            throw new NotFoundException("Empresa");
        }

        return await context.Contacts
            .AsNoTracking()
            .Where(c => c.CompanyId == request.CompanyId && c.OrganizationId == organizationId)
            .OrderBy(c => c.Name)
            .Select(c => new ContactDto(c.Id, c.CompanyId, c.Name, c.Role, c.Phone, c.WhatsApp, c.Email))
            .ToListAsync(cancellationToken);
    }
}
