using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Realtime;
using Metup.Application.LeadFinder.Common;
using Metup.Domain.Integrations;
using Metup.Domain.Users;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.LeadFinder.Commands.ChangeLeadSearch;

/// <summary>Cancelar ou reenviar uma busca. As regras de quando pode são do domínio (<c>LeadSearch</c>).</summary>
public class ChangeLeadSearchCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    ILeadSearchDispatcher dispatcher,
    IPublisher publisher) : IRequestHandler<ChangeLeadSearchCommand, LeadSearchDto>
{
    public async Task<LeadSearchDto> Handle(ChangeLeadSearchCommand request, CancellationToken cancellationToken)
    {
        currentUserService.RequirePermission(Permission.LeadFinderView);
        var organizationId = currentUserService.RequireOrganizationId();
        var nowUtc = DateTime.UtcNow;

        var search = await context.LeadSearches
            .FirstOrDefaultAsync(s => s.Id == request.LeadSearchId && s.OrganizationId == organizationId, cancellationToken)
            ?? throw new NotFoundException("Busca");

        IntegrationEvent? integrationEvent = null;
        switch (request.Action)
        {
            case LeadSearchAction.Cancel:
                search.Cancel(nowUtc);
                break;
            case LeadSearchAction.Retry:
                search.Retry(nowUtc);
                integrationEvent = LeadSearchRequests.ToIntegrationEvent(search);
                context.IntegrationEvents.Add(integrationEvent);
                break;
        }

        await context.SaveChangesAsync(cancellationToken);

        if (integrationEvent is not null)
        {
            dispatcher.Dispatch(organizationId, integrationEvent.Id);
        }

        await publisher.Publish(new LeadSearchUpdatedNotification(organizationId, search.Id), cancellationToken);

        return await search.ToDtoAsync(context, nowUtc, cancellationToken);
    }
}
