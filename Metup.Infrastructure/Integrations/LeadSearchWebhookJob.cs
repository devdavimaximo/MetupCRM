using System.Net.Http.Json;
using System.Text.Json;
using Hangfire;
using Metup.Application.Common.Interfaces;
using Metup.Domain.Integrations;
using Metup.Domain.LeadFinder;
using Metup.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Metup.Infrastructure.Integrations;

/// <summary>Põe a entrega na fila do Hangfire — a requisição do SDR não espera o n8n responder.</summary>
public sealed class HangfireLeadSearchDispatcher(IBackgroundJobClient jobs) : ILeadSearchDispatcher
{
    public void Dispatch(Guid organizationId, Guid integrationEventId) =>
        jobs.Enqueue<LeadSearchWebhookJob>(job => job.DeliverAsync(organizationId, integrationEventId, CancellationToken.None));
}

/// <summary>
/// Entrega um <c>lead_search.requested</c> ao webhook do n8n configurado na organização e marca o
/// evento como entregue. Falha (n8n fora do ar, 5xx, timeout) lança e o Hangfire tenta de novo com
/// espera crescente; esgotadas as tentativas, o evento continua pendente na fila e a tela mostra a
/// busca como "sem resposta", com opção de reenviar.
///
/// Abre o próprio contexto com a organização do evento: fora de uma requisição não há usuário para o
/// filtro de tenant resolver (<see cref="FixedTenantContext"/>).
/// </summary>
[AutomaticRetry(Attempts = 5, OnAttemptsExceeded = AttemptsExceededAction.Delete)]
public sealed class LeadSearchWebhookJob(
    DbContextOptions<MetupDbContext> options,
    IHttpClientFactory httpClientFactory,
    ILogger<LeadSearchWebhookJob> logger)
{
    public const string HttpClientName = "automation-webhooks";

    public async Task DeliverAsync(Guid organizationId, Guid integrationEventId, CancellationToken cancellationToken)
    {
        await using var db = new MetupDbContext(options, new FixedTenantContext(organizationId));

        var webhookUrl = await db.Organizations
            .Where(o => o.Id == organizationId)
            .Select(o => o.LeadSearchWebhookUrl)
            .FirstOrDefaultAsync(cancellationToken);

        // Sem webhook, o pedido fica na fila de eventos para o n8n consultar.
        if (webhookUrl is null)
        {
            return;
        }

        var integrationEvent = await db.IntegrationEvents.FirstOrDefaultAsync(e => e.Id == integrationEventId, cancellationToken);
        if (integrationEvent is null || integrationEvent.Status == IntegrationEventStatus.Delivered)
        {
            return;
        }

        using var payload = JsonDocument.Parse(integrationEvent.Payload);

        // Cancelada antes de sair: não gasta a automação (nem créditos de API) à toa.
        if (payload.RootElement.TryGetProperty("searchId", out var searchIdElement)
            && searchIdElement.TryGetGuid(out var searchId)
            && await db.LeadSearches.AnyAsync(s => s.Id == searchId && s.Status == LeadSearchStatus.Cancelled, cancellationToken))
        {
            integrationEvent.MarkDelivered(DateTime.UtcNow);
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        var client = httpClientFactory.CreateClient(HttpClientName);
        using var request = new HttpRequestMessage(HttpMethod.Post, webhookUrl)
        {
            Content = JsonContent.Create(new
            {
                id = integrationEvent.Id,
                type = integrationEvent.Type,
                organizationId = integrationEvent.OrganizationId,
                createdAt = integrationEvent.CreatedAt,
                data = payload.RootElement,
            }),
        };
        request.Headers.Add("X-Metup-Event", integrationEvent.Type);
        request.Headers.Add("X-Metup-Event-Id", integrationEvent.Id.ToString());

        using var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            // Sem PII: só o id do evento e o status.
            logger.LogWarning("Webhook do buscador de leads recusou o evento {EventId} com {StatusCode}.", integrationEvent.Id, (int)response.StatusCode);
            response.EnsureSuccessStatusCode();
        }

        integrationEvent.MarkDelivered(DateTime.UtcNow);
        await db.SaveChangesAsync(cancellationToken);
    }
}
