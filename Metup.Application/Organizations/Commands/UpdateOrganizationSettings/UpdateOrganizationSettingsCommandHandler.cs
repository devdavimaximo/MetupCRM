using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Organizations.Common;
using Metup.Domain.Users;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Organizations.Commands.UpdateOrganizationSettings;

public class UpdateOrganizationSettingsCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<UpdateOrganizationSettingsCommand, OrganizationSettingsDto>
{
    public async Task<OrganizationSettingsDto> Handle(UpdateOrganizationSettingsCommand request, CancellationToken cancellationToken)
    {
        currentUserService.RequireRole(UserRole.Admin);
        var organizationId = currentUserService.RequireOrganizationId();

        var organization = await context.Organizations
            .FirstOrDefaultAsync(o => o.Id == organizationId, cancellationToken)
            ?? throw new NotFoundException("Organização");

        organization.ChangeStalledDealDays(request.StalledDealDays);

        await context.SaveChangesAsync(cancellationToken);

        return new OrganizationSettingsDto(organization.StalledDealDays);
    }
}
