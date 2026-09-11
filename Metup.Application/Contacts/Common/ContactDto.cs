using Metup.Domain.Contacts;

namespace Metup.Application.Contacts.Common;

public record ContactDto(
    Guid Id,
    Guid CompanyId,
    string Name,
    string? Role,
    string? Phone,
    string? WhatsApp,
    string? Email)
{
    public static ContactDto FromEntity(Contact contact) => new(
        contact.Id,
        contact.CompanyId,
        contact.Name,
        contact.Role,
        contact.Phone,
        contact.WhatsApp,
        contact.Email);
}
