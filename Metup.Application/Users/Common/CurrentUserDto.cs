using Metup.Domain.Users;

namespace Metup.Application.Users.Common;

/// <summary>Quem está logado e o que pode — o front monta menu e telas a partir disto.</summary>
public record CurrentUserDto(
    Guid UserId,
    Guid OrganizationId,
    string Name,
    string Email,
    Guid RoleId,
    string RoleName,
    IReadOnlyList<Permission> Permissions);
