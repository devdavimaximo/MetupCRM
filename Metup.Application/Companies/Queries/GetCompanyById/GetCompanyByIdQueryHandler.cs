using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Companies.Common;
using Metup.Application.Contacts.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Companies.Queries.GetCompanyById;

public class GetCompanyByIdQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetCompanyByIdQuery, CompanyDto>
{
    public async Task<CompanyDto> Handle(GetCompanyByIdQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var company = await context.Companies
            .AsNoTracking()
            .Where(c => c.Id == request.Id && c.OrganizationId == organizationId)
            .Select(c => new CompanyDto(
                c.Id,
                c.Name,
                c.Segment,
                c.City,
                c.Instagram,
                c.Phone,
                c.Cnpj,
                c.Website,
                c.Contacts
                    .OrderBy(contact => contact.Name)
                    .Select(contact => new ContactDto(
                        contact.Id,
                        contact.CompanyId,
                        contact.Name,
                        contact.Role,
                        contact.Phone,
                        contact.WhatsApp,
                        contact.Email))
                    .ToList()))
            .FirstOrDefaultAsync(cancellationToken);

        return company ?? throw new NotFoundException("Empresa");
    }
}
