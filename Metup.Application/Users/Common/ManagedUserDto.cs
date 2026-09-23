namespace Metup.Application.Users.Common;

/// <summary>Linha da tela de usuários (administração).</summary>
public record ManagedUserDto(
    Guid Id,
    string Name,
    string Email,
    Guid RoleId,
    string RoleName,
    bool IsActive,
    DateTime CreatedAt);
