using Metup.Domain.Common;
using Metup.Domain.Contacts;

namespace Metup.Domain.Companies;

/// <summary>
/// Empresa-alvo da prospecção. Base de dados-mestre sobre a qual o funil (Deal) se apoia.
/// A origem (source) é atributo do Deal, não da empresa.
/// </summary>
public class Company : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public string? Segment { get; set; }

    public string? City { get; set; }

    public string? Instagram { get; set; }

    public string? Phone { get; set; }

    public ICollection<Contact> Contacts { get; init; } = [];
}
