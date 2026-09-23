using Metup.Application.Common.Interfaces;
using Metup.Application.Roles.Common;
using Metup.Domain.Users;
using MediatR;

namespace Metup.Application.Roles.Commands.CreateRole;

public class CreateRoleCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<CreateRoleCommand, RoleDto>
{
    public async Task<RoleDto> Handle(CreateRoleCommand request, CancellationToken cancellationToken)
    {
        currentUserService.RequirePermission(Permission.RolesManage);
        currentUserService.RequireCanGrant(request.Permissions);
        var organizationId = currentUserService.RequireOrganizationId();

        var name = request.Name.Trim();
        await context.EnsureRoleNameAvailableAsync(organizationId, name, exceptRoleId: null, cancellationToken);

        var role = Role.Create(organizationId, name, RoleRules.NormalizeDescription(request.Description), request.Permissions);

        context.Roles.Add(role);
        await context.SaveChangesAsync(cancellationToken);

        return new RoleDto(role.Id, role.Name, role.Description, role.IsAdministrator, role.EffectivePermissions, 0);
    }
}
