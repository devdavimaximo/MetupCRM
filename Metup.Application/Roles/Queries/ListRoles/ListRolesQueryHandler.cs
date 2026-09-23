using Metup.Application.Common.Interfaces;
using Metup.Application.Roles.Common;
using Metup.Domain.Users;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Roles.Queries.ListRoles;

/// <remarks>Lê quem gerencia cargos e quem gerencia usuários (o formulário de usuário escolhe o cargo).</remarks>
public class ListRolesQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<ListRolesQuery, IReadOnlyList<RoleDto>>
{
    public async Task<IReadOnlyList<RoleDto>> Handle(ListRolesQuery request, CancellationToken cancellationToken)
    {
        currentUserService.RequireAnyPermission(Permission.RolesManage, Permission.UsersManage);
        var organizationId = currentUserService.RequireOrganizationId();

        var roles = await context.Roles
            .AsNoTracking()
            .Where(r => r.OrganizationId == organizationId)
            .OrderByDescending(r => r.IsAdministrator)
            .ThenBy(r => r.Name)
            .ToListAsync(cancellationToken);

        var userCounts = await context.Users
            .Where(u => u.OrganizationId == organizationId)
            .GroupBy(u => u.RoleId)
            .Select(g => new { RoleId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RoleId, x => x.Count, cancellationToken);

        return
        [
            .. roles.Select(r => new RoleDto(
                r.Id,
                r.Name,
                r.Description,
                r.IsAdministrator,
                r.EffectivePermissions,
                userCounts.GetValueOrDefault(r.Id))),
        ];
    }
}
