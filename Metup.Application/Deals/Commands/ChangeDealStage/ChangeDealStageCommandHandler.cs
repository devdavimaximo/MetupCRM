using System.Text.Json;
using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Deals.Common;
using Metup.Domain.Integrations;
using Metup.Application.Common.Realtime;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Deals.Commands.ChangeDealStage;

public class ChangeDealStageCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IPublisher publisher) : IRequestHandler<ChangeDealStageCommand, DealDto>
{
    public async Task<DealDto> Handle(ChangeDealStageCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        var deal = await context.Deals
            .FirstOrDefaultAsync(d => d.Id == request.Id && d.OrganizationId == organizationId, cancellationToken)
            ?? throw new NotFoundException("Negócio");

        // Mover o negócio e gravar o StageChange são uma operação só — feita dentro do domínio.
        var stageChange = deal.ChangeStage(request.Stage, userId, DateTime.UtcNow);

        // EF Core não reconhece esse StageChange como "novo" só por estar na coleção do Deal
        // (o Guid já vem atribuído) — precisa ser rastreado explicitamente ou vira um UPDATE.
        context.StageChanges.Add(stageChange);

        var payload = JsonSerializer.Serialize(new
        {
            dealId = stageChange.DealId,
            fromStage = stageChange.FromStage?.ToString(),
            toStage = stageChange.ToStage.ToString(),
            changedByUserId = stageChange.ChangedByUserId,
            changedAt = stageChange.ChangedAt,
        });

        context.IntegrationEvents.Add(
            IntegrationEvent.Create(organizationId, IntegrationEventTypes.StageChanged, payload));

        await context.SaveChangesAsync(cancellationToken);
        await publisher.Publish(new DealStageChangedNotification(organizationId, deal.Id, deal.OwnerUserId), cancellationToken);

        return await context.Deals
            .AsNoTracking()
            .Where(d => d.Id == deal.Id)
            .ToDealDto(context)
            .FirstAsync(cancellationToken);
    }
}
