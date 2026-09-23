using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Users.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Users.Queries.GetCurrentUser;

public class GetCurrentUserQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetCurrentUserQuery, CurrentUserDto>
{
    public async Task<CurrentUserDto> Handle(GetCurrentUserQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        var user = await context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId && u.OrganizationId == organizationId && u.IsActive, cancellationToken)
            ?? throw new MissingUserContextException();

        var role = await context.GetRoleAsync(organizationId, user.RoleId, cancellationToken);

        return new CurrentUserDto(
            user.Id,
            user.OrganizationId,
            user.Name,
            user.Email,
            role.Id,
            role.Name,
            role.EffectivePermissions);
    }
}
