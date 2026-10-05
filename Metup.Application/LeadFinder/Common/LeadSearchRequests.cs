using System.Text.Json;
using Metup.Domain.Integrations;
using Metup.Domain.LeadFinder;

namespace Metup.Application.LeadFinder.Common;

/// <summary>
/// O evento <c>lead_search.requested</c> que a automação recebe (webhook ou fila). Contrato com o n8n
/// documentado em <c>docs/planning/n8n-buscador-de-leads.md</c>: campos só entram, nunca mudam de nome.
/// </summary>
public static class LeadSearchRequests
{
    public static IntegrationEvent ToIntegrationEvent(LeadSearch search)
    {
        var payload = JsonSerializer.Serialize(new
        {
            searchId = search.Id,
            query = search.Query,
            location = search.Location,
            maxResults = search.MaxResults,
            requestedAt = search.RequestedAt,
            resultsPath = $"/api/integrations/lead-searches/{search.Id}/results",
            completePath = $"/api/integrations/lead-searches/{search.Id}/complete",
        });

        return IntegrationEvent.Create(search.OrganizationId, IntegrationEventTypes.LeadSearchRequested, payload);
    }
}
