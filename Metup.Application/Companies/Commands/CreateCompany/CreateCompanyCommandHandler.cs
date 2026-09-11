using Metup.Application.Common.Extensions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Companies.Common;
using Metup.Domain.Companies;
using MediatR;

namespace Metup.Application.Companies.Commands.CreateCompany;

public class CreateCompanyCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<CreateCompanyCommand, CompanyDto>
{
    public async Task<CompanyDto> Handle(CreateCompanyCommand request, CancellationToken cancellationToken)
    {
        var company = new Company
        {
            OrganizationId = currentUserService.RequireOrganizationId(),
            Name = request.Name.NormalizeRequired(),
            Segment = request.Segment.NormalizeOptional(),
            City = request.City.NormalizeOptional(),
            Instagram = request.Instagram.NormalizeOptional(),
            Phone = request.Phone.NormalizeOptional(),
        };

        context.Companies.Add(company);
        await context.SaveChangesAsync(cancellationToken);

        return new CompanyDto(
            company.Id,
            company.Name,
            company.Segment,
            company.City,
            company.Instagram,
            company.Phone,
            []);
    }
}
