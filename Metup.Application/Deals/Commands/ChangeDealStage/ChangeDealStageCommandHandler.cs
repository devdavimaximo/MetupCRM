using System.Text.Json;
using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Deals.Common;
using Metup.Domain.Deals;
using Metup.Domain.Integrations;
using Metup.Application.Common.Realtime;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Deals.Commands.ChangeDealStage;

/// <summary>
/// Aguenta o arrasto do quadro: pedir a etapa em que o negócio já está é sucesso sem efeito (nenhum
/// StageChange, evento ou aviso em tempo real), e <c>ExpectedFromStage</c> diferente da etapa atual
/// é conflito com o estado atual no corpo. Só a mudança real grava StageChange, emite
/// <c>stage.changed</c> para o n8n e avisa as telas — uma vez cada.
/// </summary>
/// <remarks>
/// A checagem é ler-e-gravar, sem token de concorrência no banco: dois pedidos simultâneos que leem a
/// mesma etapa ainda podem gravar duas transições. Protege o caso comum (outro usuário moveu antes).
/// </remarks>
public class ChangeDealStageCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock,
    IPublisher publisher) : IRequestHandler<ChangeDealStageCommand, DealDto>
{
    public async Task<DealDto> Handle(ChangeDealStageCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        var deal = await context.Deals
            .FirstOrDefaultAsync(d => d.Id == request.Id && d.OrganizationId == organizationId, cancellationToken)
            ?? throw new NotFoundException("Negócio");

        // Já está onde o client quer: nada a gravar. Vale também para o reenvio de um arrasto que já
        // foi aplicado — por isso vem antes da checagem da etapa esperada.
        if (deal.Status == DealStatus.Aberto && deal.Stage == request.Stage)
        {
            return await CurrentDealAsync(deal.Id, cancellationToken);
        }

        if (request.ExpectedFromStage is { } expected && expected != deal.Stage)
        {
            throw new StaleStateException(
                "O negócio já não está na etapa em que você o viu.",
                await CurrentDealAsync(deal.Id, cancellationToken));
        }

        var clock = await organizationClock.SnapshotAsync(cancellationToken);

        // Mover o negócio e gravar o StageChange são uma operação só — feita dentro do domínio.
        var stageChange = deal.ChangeStage(request.Stage, userId, clock.UtcNow);

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

        return await CurrentDealAsync(deal.Id, cancellationToken);
    }

    private Task<DealDto> CurrentDealAsync(Guid dealId, CancellationToken cancellationToken) =>
        context.Deals
            .AsNoTracking()
            .Where(d => d.Id == dealId)
            .ToDealDto(context)
            .FirstAsync(cancellationToken);
}
