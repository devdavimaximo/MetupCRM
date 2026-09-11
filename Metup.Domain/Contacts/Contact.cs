using Metup.Domain.Common;

namespace Metup.Domain.Contacts;

/// <summary>
/// Pessoa dentro de uma empresa-alvo. Sempre pertence a uma Company da mesma organização.
/// </summary>
public class Contact : BaseEntity
{
    public Guid CompanyId { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>Cargo da pessoa na empresa (texto livre) — não confundir com <c>UserRole</c>.</summary>
    public string? Role { get; set; }

    public string? Phone { get; set; }

    public string? WhatsApp { get; set; }

    public string? Email { get; set; }
}
