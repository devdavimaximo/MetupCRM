using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Deals.Common;
using Metup.Domain.Deals;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Deals.Commands.CreateDeal;

public class CreateDealCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<CreateDealCommand, DealDto>
{
    public async Task<DealDto> Handle(CreateDealCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        // Empresa, contato e responsável precisam existir DENTRO da organização do usuário —
        // mesmo padrão que CreateContactCommandHandler já usa (404 genérico, sem vazar dado de outra org).
        var companyExists = await context.Companies
            .AnyAsync(c => c.Id == request.CompanyId && c.OrganizationId == organizationId, cancellationToken);
        if (!companyExists)
        {
            throw new NotFoundException("Empresa");
        }

        if (request.ContactId is { } contactId)
        {
            var contactExists = await context.Contacts
                .AnyAsync(
                    c => c.Id == contactId && c.CompanyId == request.CompanyId && c.OrganizationId == organizationId,
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

        var deal = Deal.Create(
            organizationId,
            request.CompanyId,
            request.ContactId,
            request.InitialStage,
            request.Source,
            request.OwnerUserId,
            request.Ticket,
            request.Amount,
            userId,
            DateTime.UtcNow);

        context.Deals.Add(deal);
        await context.SaveChangesAsync(cancellationToken);

        return await context.Deals
            .AsNoTracking()
            .Where(d => d.Id == deal.Id)
            .ToDealDto(context)
            .FirstAsync(cancellationToken);
    }
}
