using Metup.Application.Common.Interfaces;
using Metup.Application.Users.Common;
using Metup.Domain.Users;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Roles.Commands.DeleteRole;

/// <remarks>Só cargo vazio sai — contando desativados, que continuam presos ao cargo.</remarks>
public class DeleteRoleCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<DeleteRoleCommand>
{
    public async Task Handle(DeleteRoleCommand request, CancellationToken cancellationToken)
    {
        currentUserService.RequirePermission(Permission.RolesManage);
        var organizationId = currentUserService.RequireOrganizationId();

        var role = await context.GetRoleAsync(organizationId, request.Id, cancellationToken);
        currentUserService.RequireCanGrant(role.EffectivePermissions);

        var assignedUsers = await context.Users.CountAsync(u => u.RoleId == role.Id, cancellationToken);
        role.EnsureCanBeDeleted(assignedUsers);

        context.Roles.Remove(role);
        await context.SaveChangesAsync(cancellationToken);
    }
}
