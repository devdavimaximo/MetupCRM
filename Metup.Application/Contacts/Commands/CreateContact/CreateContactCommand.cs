using Metup.Application.Contacts.Common;
using MediatR;

namespace Metup.Application.Contacts.Commands.CreateContact;

/// <param name="Role">Cargo na empresa — texto livre, não é permissão de usuário.</param>
public record CreateContactCommand(
    Guid CompanyId,
    string Name,
    string? Role,
    string? Phone,
    string? WhatsApp,
    string? Email) : IRequest<ContactDto>;
