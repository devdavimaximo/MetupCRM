using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Extensions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Contacts.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Contacts.Commands.UpdateContact;

public class UpdateContactCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<UpdateContactCommand, ContactDto>
{
    public async Task<ContactDto> Handle(UpdateContactCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var contact = await context.Contacts
            .FirstOrDefaultAsync(
                c => c.Id == request.Id && c.OrganizationId == organizationId,
                cancellationToken)
            ?? throw new NotFoundException("Contato");

        contact.Name = request.Name.NormalizeRequired();
        contact.Role = request.Role.NormalizeOptional();
        contact.Phone = request.Phone.NormalizeOptional();
        contact.WhatsApp = request.WhatsApp.NormalizeOptional();
        contact.Email = request.Email.NormalizeOptional();

        await context.SaveChangesAsync(cancellationToken);

        return ContactDto.FromEntity(contact);
    }
}
