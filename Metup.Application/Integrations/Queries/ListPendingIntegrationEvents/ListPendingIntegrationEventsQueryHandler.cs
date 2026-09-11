using Metup.Application.Common.Interfaces;
using Metup.Application.Integrations.Common;
using Metup.Domain.Integrations;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Integrations.Queries.ListPendingIntegrationEvents;

/// <summary>O n8n consulta isso periodicamente — a fila de saída da seção 6 do CLAUDE.md.</summary>
public class ListPendingIntegrationEventsQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<ListPendingIntegrationEventsQuery, IReadOnlyList<IntegrationEventDto>>
{
    public async Task<IReadOnlyList<IntegrationEventDto>> Handle(
        ListPendingIntegrationEventsQuery request,
        CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var limit = Math.Clamp(request.Limit, 1, 200);

        return await context.IntegrationEvents
            .AsNoTracking()
            .Where(e => e.OrganizationId == organizationId && e.Status == IntegrationEventStatus.Pending)
            .OrderBy(e => e.CreatedAt)
            .Take(limit)
            .Select(e => new IntegrationEventDto(e.Id, e.Type, e.Payload, e.CreatedAt))
            .ToListAsync(cancellationToken);
    }
}
