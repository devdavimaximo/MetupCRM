using Metup.Application.Common.Interfaces;
using Metup.Application.Users.Common;
using Metup.Domain.Users;
using MediatR;

namespace Metup.Application.Users.Commands.UpdateUser;

public class UpdateUserCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<UpdateUserCommand, ManagedUserDto>
{
    public async Task<ManagedUserDto> Handle(UpdateUserCommand request, CancellationToken cancellationToken)
    {
        currentUserService.RequirePermission(Permission.UsersManage);
        var organizationId = currentUserService.RequireOrganizationId();

        var user = await context.GetManageableUserAsync(currentUserService, organizationId, request.Id, cancellationToken);

        var email = UserEmail.Normalize(request.Email);
        await context.EnsureEmailAvailableAsync(email, user.Id, nameof(request.Email), cancellationToken);

        var role = await context.GetRoleAsync(organizationId, request.RoleId, cancellationToken);
        if (role.Id != user.RoleId)
        {
            currentUserService.RequireCanGrant(role.EffectivePermissions);
        }

        user.Name = request.Name.Trim();
        user.Email = email;
        user.RoleId = role.Id;

        await context.EnsureActiveAdministratorRemainsAsync(organizationId, user, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return new ManagedUserDto(user.Id, user.Name, user.Email, role.Id, role.Name, user.IsActive, user.CreatedAt);
    }
}
