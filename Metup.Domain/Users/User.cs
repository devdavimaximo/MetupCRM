using Metup.Domain.Common;

namespace Metup.Domain.Users;

public class User : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    /// <summary>Cargo do usuário — define as permissões (<see cref="Role"/>).</summary>
    public Guid RoleId { get; set; }

    /// <summary>Desativado não entra nem usa um token já emitido; o histórico dele continua.</summary>
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}
