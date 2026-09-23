using Metup.Domain.Users;

namespace Metup.Application.Roles.Common;

/// <summary>Cargo com as permissões efetivas e quantos usuários (ativos ou não) estão nele.</summary>
public record RoleDto(
    Guid Id,
    string Name,
    string? Description,
    bool IsAdministrator,
    IReadOnlyList<Permission> Permissions,
    int UserCount);
