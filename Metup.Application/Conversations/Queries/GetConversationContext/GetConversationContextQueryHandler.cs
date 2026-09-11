using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Conversations.Common;
using Metup.Domain.Deals;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Conversations.Queries.GetConversationContext;

public class GetConversationContextQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetConversationContextQuery, ConversationContextDto>
{
    public async Task<ConversationContextDto> Handle(GetConversationContextQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var contactId = await context.Conversations
            .AsNoTracking()
            .Where(c => c.Id == request.ConversationId && c.OrganizationId == organizationId)
            .Select(c => c.ContactId)
            .FirstOrDefaultAsync(cancellationToken);
        if (contactId == Guid.Empty)
        {
            throw new NotFoundException("Conversa");
        }

        var contact = await context.Contacts
            .AsNoTracking()
            .Where(c => c.Id == contactId)
            .Select(c => new { c.Id, c.Name, c.Role, c.Phone, c.WhatsApp, c.Email, c.CompanyId })
            .FirstAsync(cancellationToken);

        var companyName = await context.Companies
            .AsNoTracking()
            .Where(co => co.Id == contact.CompanyId)
            .Select(co => co.Name)
            .FirstAsync(cancellationToken);

        var deal = await context.Deals
            .AsNoTracking()
            .Where(d => d.OrganizationId == organizationId && d.ContactId == contactId)
            .OrderBy(d => d.Status == DealStatus.Aberto ? 0 : 1)
            .ThenByDescending(d => d.CreatedAt)
            .Select(d => new { d.Id, d.Stage, d.Status, d.Ticket, d.Amount })
            .FirstOrDefaultAsync(cancellationToken);

        return new ConversationContextDto(
            contact.Id,
            contact.Name,
            contact.Role,
            contact.Phone,
            contact.WhatsApp,
            contact.Email,
            contact.CompanyId,
            companyName,
            deal?.Id,
            deal?.Stage,
            deal?.Status,
            deal?.Ticket,
            deal?.Amount);
    }
}
