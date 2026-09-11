using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Contacts.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Contacts.Queries.GetContactById;

public class GetContactByIdQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetContactByIdQuery, ContactDto>
{
    public async Task<ContactDto> Handle(GetContactByIdQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var contact = await context.Contacts
            .AsNoTracking()
            .Where(c => c.Id == request.Id && c.OrganizationId == organizationId)
            .Select(c => new ContactDto(c.Id, c.CompanyId, c.Name, c.Role, c.Phone, c.WhatsApp, c.Email))
            .FirstOrDefaultAsync(cancellationToken);

        return contact ?? throw new NotFoundException("Contato");
    }
}
