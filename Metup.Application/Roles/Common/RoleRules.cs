using FluentValidation;
using FluentValidation.Results;
using Metup.Application.Common.Interfaces;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Roles.Common;

public static class RoleRules
{
    /// <summary>Nome único por organização, sem diferenciar maiúsculas ("SDR" e "sdr" não coexistem).</summary>
    public static async Task EnsureRoleNameAvailableAsync(
        this IApplicationDbContext context,
        Guid organizationId,
        string name,
        Guid? exceptRoleId,
        CancellationToken cancellationToken)
    {
        var lowered = name.ToLower();
        var inUse = await context.Roles.AnyAsync(
            r => r.OrganizationId == organizationId && r.Name.ToLower() == lowered && r.Id != exceptRoleId,
            cancellationToken);

        if (inUse)
        {
            throw new ValidationException([new ValidationFailure("Name", "Já existe um cargo com este nome.")]);
        }
    }

    public static async Task<RoleDto> ToDtoAsync(this IApplicationDbContext context, Role role, CancellationToken cancellationToken)
    {
        var userCount = await context.Users.CountAsync(u => u.RoleId == role.Id, cancellationToken);
        return new RoleDto(role.Id, role.Name, role.Description, role.IsAdministrator, role.EffectivePermissions, userCount);
    }

    public static string? NormalizeDescription(string? description) =>
        string.IsNullOrWhiteSpace(description) ? null : description.Trim();
}
