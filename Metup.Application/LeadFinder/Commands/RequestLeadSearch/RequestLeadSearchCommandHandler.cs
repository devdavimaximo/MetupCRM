using Metup.Application.Common.Extensions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Realtime;
using Metup.Application.LeadFinder.Common;
using Metup.Domain.LeadFinder;
using Metup.Domain.Users;
using MediatR;

namespace Metup.Application.LeadFinder.Commands.RequestLeadSearch;

/// <summary>
/// O SDR pede uma busca pela tela. O CRM grava o pedido e o evento de saída na mesma transação e só
/// então avisa o despachante — quem garimpa é a automação (seção 5 do CLAUDE.md).
/// </summary>
public class RequestLeadSearchCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    ILeadSearchDispatcher dispatcher,
    IPublisher publisher) : IRequestHandler<RequestLeadSearchCommand, LeadSearchDto>
{
    public async Task<LeadSearchDto> Handle(RequestLeadSearchCommand request, CancellationToken cancellationToken)
    {
        currentUserService.RequirePermission(Permission.LeadFinderView);
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();
        var nowUtc = DateTime.UtcNow;

        var search = LeadSearch.Request(
            organizationId,
            request.Query.NormalizeRequired(),
            request.Location.NormalizeOptional(),
            request.MaxResults,
            request.WithoutWebsite,
            userId,
            nowUtc);
        context.LeadSearches.Add(search);

        var integrationEvent = LeadSearchRequests.ToIntegrationEvent(search);
        context.IntegrationEvents.Add(integrationEvent);

        await context.SaveChangesAsync(cancellationToken);

        dispatcher.Dispatch(organizationId, integrationEvent.Id);
        await publisher.Publish(new LeadSearchUpdatedNotification(organizationId, search.Id), cancellationToken);

        return await search.ToDtoAsync(context, nowUtc, cancellationToken);
    }
}
