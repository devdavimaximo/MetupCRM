using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Extensions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Contacts.Common;
using Metup.Domain.Contacts;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Contacts.Commands.CreateContact;

public class CreateContactCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<CreateContactCommand, ContactDto>
{
    public async Task<ContactDto> Handle(CreateContactCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        // A empresa precisa existir DENTRO da organização do usuário — nunca vincular
        // um contato a uma empresa de outra organização.
        var companyExists = await context.Companies
            .AnyAsync(
                c => c.Id == request.CompanyId && c.OrganizationId == organizationId,
                cancellationToken);

        if (!companyExists)
        {
            throw new NotFoundException("Empresa");
        }

        var contact = new Contact
        {
            OrganizationId = organizationId,
            CompanyId = request.CompanyId,
            Name = request.Name.NormalizeRequired(),
            Role = request.Role.NormalizeOptional(),
            Phone = request.Phone.NormalizeOptional(),
            WhatsApp = request.WhatsApp.NormalizeOptional(),
            Email = request.Email.NormalizeOptional(),
        };

        context.Contacts.Add(contact);
        await context.SaveChangesAsync(cancellationToken);

        return ContactDto.FromEntity(contact);
    }
}
