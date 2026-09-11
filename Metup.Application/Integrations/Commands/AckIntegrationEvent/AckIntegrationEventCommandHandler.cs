using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Integrations.Commands.AckIntegrationEvent;

/// <summary>Confirmação de entrega do n8n — idempotente: reconfirmar um evento já entregue não é erro.</summary>
public class AckIntegrationEventCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<AckIntegrationEventCommand>
{
    public async Task Handle(AckIntegrationEventCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var integrationEvent = await context.IntegrationEvents
            .Where(e => e.Id == request.EventId && e.OrganizationId == organizationId)
            .FirstOrDefaultAsync(cancellationToken);
        if (integrationEvent is null)
        {
            throw new NotFoundException("Evento de integração");
        }

        integrationEvent.MarkDelivered(DateTime.UtcNow);

        await context.SaveChangesAsync(cancellationToken);
    }
}
