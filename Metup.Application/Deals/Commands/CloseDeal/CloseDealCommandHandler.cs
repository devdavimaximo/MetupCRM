using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Deals.Common;
using Metup.Application.Common.Realtime;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Deals.Commands.CloseDeal;

public class CloseDealCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IPublisher publisher) : IRequestHandler<CloseDealCommand, DealDto>
{
    public async Task<DealDto> Handle(CloseDealCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        var deal = await context.Deals
            .FirstOrDefaultAsync(d => d.Id == request.Id && d.OrganizationId == organizationId, cancellationToken)
            ?? throw new NotFoundException("Negócio");

        var stageChange = deal.Close(request.Won, request.ClosedAmount, userId, DateTime.UtcNow);

        // Mesma observação do ChangeDealStageCommandHandler: rastreamento explícito é
        // necessário para o EF Core gerar um INSERT em vez de tentar um UPDATE.
        context.StageChanges.Add(stageChange);

        await context.SaveChangesAsync(cancellationToken);
        await publisher.Publish(new DealClosedNotification(organizationId, deal.Id, deal.OwnerUserId), cancellationToken);

        return await context.Deals
            .AsNoTracking()
            .Where(d => d.Id == deal.Id)
            .ToDealDto(context)
            .FirstAsync(cancellationToken);
    }
}
