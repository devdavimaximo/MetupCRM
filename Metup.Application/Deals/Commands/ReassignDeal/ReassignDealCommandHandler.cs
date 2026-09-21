using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Deals.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Deals.Commands.ReassignDeal;

/// <summary>
/// O destino precisa ser da mesma organização (404 genérico, como em Tarefas). <b>Nenhum evento
/// novo para o n8n</b>: trocar de responsável não muda o funil (decisão da PL3).
/// </summary>
public class ReassignDealCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<ReassignDealCommand, DealDto>
{
    public async Task<DealDto> Handle(ReassignDealCommand request, CancellationToken cancellationToken)
    {
        currentUserService.RequireDealReassign();

        var deal = await context.LoadDealForActionAsync(currentUserService, request.Id, cancellationToken);

        var ownerExists = await context.Users
            .AnyAsync(u => u.Id == request.OwnerUserId && u.OrganizationId == deal.OrganizationId, cancellationToken);
        if (!ownerExists)
        {
            throw new NotFoundException("Responsável");
        }

        deal.Reassign(request.OwnerUserId);

        await context.SaveChangesAsync(cancellationToken);

        return await context.Deals
            .AsNoTracking()
            .Where(d => d.Id == deal.Id)
            .ToDealDto(context)
            .FirstAsync(cancellationToken);
    }
}
