using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Extensions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Companies.Common;
using Metup.Application.Contacts.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Companies.Commands.UpdateCompany;

public class UpdateCompanyCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<UpdateCompanyCommand, CompanyDto>
{
    public async Task<CompanyDto> Handle(UpdateCompanyCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var company = await context.Companies
            .Include(c => c.Contacts)
            .FirstOrDefaultAsync(
                c => c.Id == request.Id && c.OrganizationId == organizationId,
                cancellationToken)
            ?? throw new NotFoundException("Empresa");

        company.Name = request.Name.NormalizeRequired();
        company.Segment = request.Segment.NormalizeOptional();
        company.City = request.City.NormalizeOptional();
        company.Instagram = request.Instagram.NormalizeOptional();
        company.Phone = request.Phone.NormalizeOptional();

        await context.SaveChangesAsync(cancellationToken);

        return new CompanyDto(
            company.Id,
            company.Name,
            company.Segment,
            company.City,
            company.Instagram,
            company.Phone,
            [.. company.Contacts.OrderBy(c => c.Name).Select(ContactDto.FromEntity)]);
    }
}
