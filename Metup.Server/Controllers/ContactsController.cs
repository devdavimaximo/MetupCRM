using Metup.Application.Contacts.Commands.UpdateContact;
using Metup.Application.Contacts.Common;
using Metup.Application.Contacts.Queries.GetContactById;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>
/// A criação e a listagem de contatos vivem sob /api/companies/{companyId}/contacts —
/// contato só existe dentro de uma empresa. Aqui ficam as operações sobre o contato já existente.
/// </remarks>
[ApiController]
[Authorize]
[Route("api/contacts")]
public class ContactsController(ISender sender) : ControllerBase
{
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ContactDto>> GetById(Guid id, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetContactByIdQuery(id), cancellationToken));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ContactDto>> Update(
        Guid id,
        UpdateContactRequest request,
        CancellationToken cancellationToken)
    {
        var command = new UpdateContactCommand(
            id,
            request.Name,
            request.Role,
            request.Phone,
            request.WhatsApp,
            request.Email);

        return Ok(await sender.Send(command, cancellationToken));
    }
}

public record UpdateContactRequest(
    string Name,
    string? Role,
    string? Phone,
    string? WhatsApp,
    string? Email);
