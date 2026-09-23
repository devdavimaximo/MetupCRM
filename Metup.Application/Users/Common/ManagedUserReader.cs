using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Users.Common;

/// <summary>A linha da tela de usuários — a listagem e os comandos devolvem o mesmo formato.</summary>
public static class ManagedUserReader
{
    /// <summary>Ativos primeiro, depois por nome.</summary>
    public static async Task<IReadOnlyList<ManagedUserDto>> ListManagedUsersAsync(
        this IApplicationDbContext context,
        Guid organizationId,
        Guid? userId,
        CancellationToken cancellationToken) =>
        await context.Users
            .AsNoTracking()
            .Where(u => u.OrganizationId == organizationId && (userId == null || u.Id == userId))
            .Join(context.Roles, u => u.RoleId, r => r.Id, (u, r) => new { User = u, Role = r })
            .OrderByDescending(x => x.User.IsActive)
            .ThenBy(x => x.User.Name)
            .Select(x => new ManagedUserDto(
                x.User.Id,
                x.User.Name,
                x.User.Email,
                x.Role.Id,
                x.Role.Name,
                x.User.IsActive,
                x.User.CreatedAt))
            .ToListAsync(cancellationToken);

    public static async Task<ManagedUserDto> GetManagedUserAsync(
        this IApplicationDbContext context,
        Guid organizationId,
        Guid userId,
        CancellationToken cancellationToken) =>
        (await context.ListManagedUsersAsync(organizationId, userId, cancellationToken)).FirstOrDefault()
            ?? throw new NotFoundException("Usuário");
}
