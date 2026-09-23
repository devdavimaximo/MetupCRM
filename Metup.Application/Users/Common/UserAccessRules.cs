using FluentValidation;
using FluentValidation.Results;
using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Domain.Common.Exceptions;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Users.Common;

/// <summary>Regras que envolvem mais de um usuário/cargo — o que a entidade sozinha não enxerga.</summary>
public static class UserAccessRules
{
    /// <summary>E-mail é único no sistema inteiro (é a chave de login), não só na organização.</summary>
    public static async Task EnsureEmailAvailableAsync(
        this IApplicationDbContext context,
        string normalizedEmail,
        Guid? exceptUserId,
        string propertyName,
        CancellationToken cancellationToken)
    {
        var inUse = await context.Users
            .AnyAsync(u => u.Email.ToLower() == normalizedEmail && u.Id != exceptUserId, cancellationToken);

        if (inUse)
        {
            throw new ValidationException([new ValidationFailure(propertyName, "Já existe um usuário com este e-mail.")]);
        }
    }

    /// <summary>Cargo da própria organização — id de outra organização vira "não encontrado".</summary>
    public static async Task<Role> GetRoleAsync(
        this IApplicationDbContext context,
        Guid organizationId,
        Guid roleId,
        CancellationToken cancellationToken) =>
        await context.Roles.FirstOrDefaultAsync(r => r.Id == roleId && r.OrganizationId == organizationId, cancellationToken)
            ?? throw new NotFoundException("Cargo");

    /// <summary>
    /// Carrega um usuário da organização para ser administrado. Só administra quem poderia conceder
    /// o cargo atual dele — senão quem gerencia usuários redefiniria a senha de um administrador.
    /// </summary>
    public static async Task<User> GetManageableUserAsync(
        this IApplicationDbContext context,
        ICurrentUserService currentUserService,
        Guid organizationId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var user = await context.Users
            .FirstOrDefaultAsync(u => u.Id == userId && u.OrganizationId == organizationId, cancellationToken)
            ?? throw new NotFoundException("Usuário");

        var currentRole = await context.GetRoleAsync(organizationId, user.RoleId, cancellationToken);
        currentUserService.RequireCanGrant(currentRole.EffectivePermissions);

        return user;
    }

    /// <summary>
    /// A organização nunca fica sem administrador ativo. Chamar depois de aplicar a mudança no
    /// usuário (antes de salvar): lança se ela tirou o último.
    /// </summary>
    public static async Task EnsureActiveAdministratorRemainsAsync(
        this IApplicationDbContext context,
        Guid organizationId,
        User changedUser,
        CancellationToken cancellationToken)
    {
        var changedUserIsActiveAdmin = changedUser.IsActive && await context.Roles
            .AnyAsync(r => r.Id == changedUser.RoleId && r.IsAdministrator, cancellationToken);
        if (changedUserIsActiveAdmin)
        {
            return;
        }

        var administratorRoleIds = context.Roles
            .Where(r => r.OrganizationId == organizationId && r.IsAdministrator)
            .Select(r => r.Id);

        var otherActiveAdmins = await context.Users
            .AnyAsync(
                u => u.OrganizationId == organizationId
                    && u.Id != changedUser.Id
                    && u.IsActive
                    && administratorRoleIds.Contains(u.RoleId),
                cancellationToken);

        if (!otherActiveAdmins)
        {
            throw new DomainRuleException("A organização precisa de ao menos um administrador ativo.");
        }
    }
}
