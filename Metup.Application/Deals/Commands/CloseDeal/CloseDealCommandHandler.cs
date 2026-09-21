using Metup.Application.Common.Interfaces;
using Metup.Application.Deals.Common;
using Metup.Application.Common.Realtime;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Deals.Commands.CloseDeal;

/// <remarks>
/// Só pela API de usuário: exige usuário logado, então o service token do n8n não fecha negócio.
/// Se um dia existir fechamento pela integração, motivo ausente vira <c>LostReason.Outro</c> no
/// caso de uso da ingestão — o domínio continua exigindo um motivo.
/// </remarks>
public class CloseDealCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock,
    IPublisher publisher) : IRequestHandler<CloseDealCommand, DealDto>
{
    public async Task<DealDto> Handle(CloseDealCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        var deal = await context.LoadDealForActionAsync(currentUserService, request.Id, cancellationToken);

        var clock = await organizationClock.SnapshotAsync(cancellationToken);
        var closure = deal.Close(request.Won, request.ClosedAmount, request.LostReason, request.LostNote, userId, clock.UtcNow);

        // Mesma observação do ChangeDealStageCommandHandler: rastreamento explícito é
        // necessário para o EF Core gerar um INSERT em vez de tentar um UPDATE.
        context.StageChanges.Add(closure.StageChange);
        if (closure.ValueChange is { } valueChange)
        {
            context.DealValueChanges.Add(valueChange);
        }

        await context.SaveChangesAsync(cancellationToken);
        await publisher.Publish(new DealClosedNotification(organizationId, deal.Id, deal.OwnerUserId), cancellationToken);

        return await context.Deals
            .AsNoTracking()
            .Where(d => d.Id == deal.Id)
            .ToDealDto(context)
            .FirstAsync(cancellationToken);
    }
}
