using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Realtime;
using Metup.Domain.LeadFinder;
using Metup.Domain.Users;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.LeadFinder.Commands.TriageFoundLeads;

/// <summary>Descartar (fora do perfil) ou devolver para "novos". Importados não mudam por aqui.</summary>
public class TriageFoundLeadsCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IPublisher publisher) : IRequestHandler<TriageFoundLeadsCommand, int>
{
    public async Task<int> Handle(TriageFoundLeadsCommand request, CancellationToken cancellationToken)
    {
        currentUserService.RequirePermission(Permission.LeadFinderView);
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();
        var nowUtc = DateTime.UtcNow;

        var from = request.Action == TriageAction.Discard ? FoundLeadStatus.New : FoundLeadStatus.Discarded;
        var ids = request.Ids.Distinct().ToList();

        var leads = await context.FoundLeads
            .Where(l => ids.Contains(l.Id) && l.OrganizationId == organizationId && l.Status == from)
            .ToListAsync(cancellationToken);

        foreach (var lead in leads)
        {
            if (request.Action == TriageAction.Discard)
            {
                lead.Discard(userId, nowUtc);
            }
            else
            {
                lead.Restore(userId, nowUtc);
            }
        }

        await context.SaveChangesAsync(cancellationToken);

        foreach (var searchId in leads.Select(l => l.LeadSearchId).Distinct())
        {
            await publisher.Publish(new LeadSearchUpdatedNotification(organizationId, searchId), cancellationToken);
        }

        return leads.Count;
    }
}
