using Metup.Application.Common.Interfaces;
using Metup.Application.Roles.Common;
using Metup.Application.Users.Common;
using Metup.Domain.Users;
using MediatR;

namespace Metup.Application.Roles.Commands.UpdateRole;

public class UpdateRoleCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<UpdateRoleCommand, RoleDto>
{
    public async Task<RoleDto> Handle(UpdateRoleCommand request, CancellationToken cancellationToken)
    {
        currentUserService.RequirePermission(Permission.RolesManage);
        var organizationId = currentUserService.RequireOrganizationId();

        var role = await context.GetRoleAsync(organizationId, request.Id, cancellationToken);

        // Só mexe em cargo que poderia criar: nem conceder, nem tirar o que o próprio cargo não tem.
        currentUserService.RequireCanGrant(role.EffectivePermissions);
        currentUserService.RequireCanGrant(request.Permissions);

        var name = request.Name.Trim();
        await context.EnsureRoleNameAvailableAsync(organizationId, name, role.Id, cancellationToken);

        role.Update(name, RoleRules.NormalizeDescription(request.Description), request.Permissions);

        await context.SaveChangesAsync(cancellationToken);

        return await context.ToDtoAsync(role, cancellationToken);
    }
}
