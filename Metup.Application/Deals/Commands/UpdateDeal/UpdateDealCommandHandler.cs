using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Deals.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Deals.Commands.UpdateDeal;

public class UpdateDealCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock) : IRequestHandler<UpdateDealCommand, DealDto>
{
    public async Task<DealDto> Handle(UpdateDealCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        var deal = await context.Deals
            .FirstOrDefaultAsync(d => d.Id == request.Id && d.OrganizationId == organizationId, cancellationToken)
            ?? throw new NotFoundException("Negócio");

        if (request.ContactId is { } contactId)
        {
            var contactExists = await context.Contacts
                .AnyAsync(
                    c => c.Id == contactId && c.CompanyId == deal.CompanyId && c.OrganizationId == organizationId,
                    cancellationToken);
            if (!contactExists)
            {
                throw new NotFoundException("Contato");
            }
        }

        var ownerExists = await context.Users
            .AnyAsync(u => u.Id == request.OwnerUserId && u.OrganizationId == organizationId, cancellationToken);
        if (!ownerExists)
        {
            throw new NotFoundException("Responsável");
        }

        deal.ContactId = request.ContactId;
        deal.Source = request.Source;
        deal.OwnerUserId = request.OwnerUserId;

        var clock = await organizationClock.SnapshotAsync(cancellationToken);
        deal.SetExpectedCloseDate(request.ExpectedCloseDate, clock.LocalDateOf(deal.CreatedAt));

        // Valor muda pelo domínio, que devolve o histórico só quando algo mudou de fato.
        if (deal.ChangeValue(request.Amount, request.Ticket, userId, clock.UtcNow) is { } valueChange)
        {
            context.DealValueChanges.Add(valueChange);
        }

        await context.SaveChangesAsync(cancellationToken);

        return await context.Deals
            .AsNoTracking()
            .Where(d => d.Id == deal.Id)
            .ToDealDto(context)
            .FirstAsync(cancellationToken);
    }
}
