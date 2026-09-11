using Metup.Application.Contacts.Common;
using MediatR;

namespace Metup.Application.Contacts.Commands.UpdateContact;

/// <remarks>O contato não troca de empresa por aqui: a ficha edita os dados da pessoa.</remarks>
public record UpdateContactCommand(
    Guid Id,
    string Name,
    string? Role,
    string? Phone,
    string? WhatsApp,
    string? Email) : IRequest<ContactDto>;
