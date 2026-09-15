using Metup.Application.Common.Realtime;
using MediatR;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace Metup.Infrastructure.Realtime;

/// <summary>Mensagem enxuta do hub: o que mudou e em qual negócio. Nada além disso sai do servidor.</summary>
public sealed record RealtimeEventMessage(string Type, Guid? DealId, Guid? OwnerUserId);

/// <summary>
/// Leva os avisos in-process dos comandos até as telas abertas: eventos de negócio vão para o grupo
/// da organização; os pessoais (tarefa concluída) só para o grupo do responsável.
///
/// Falha de entrega é registrada e engolida: o comando já foi gravado, e o tempo real é só
/// aceleração. As telas revalidam ao reconectar.
/// </summary>
public sealed class DashboardRealtimeNotifier(
    IHubContext<DashboardHub> hubContext,
    ILogger<DashboardRealtimeNotifier> logger) :
    INotificationHandler<DealCreatedNotification>,
    INotificationHandler<DealStageChangedNotification>,
    INotificationHandler<DealClosedNotification>,
    INotificationHandler<ActivityLoggedNotification>,
    INotificationHandler<TaskCompletedNotification>
{
    public Task Handle(DealCreatedNotification notification, CancellationToken cancellationToken) => SendAsync(notification, cancellationToken);

    public Task Handle(DealStageChangedNotification notification, CancellationToken cancellationToken) => SendAsync(notification, cancellationToken);

    public Task Handle(DealClosedNotification notification, CancellationToken cancellationToken) => SendAsync(notification, cancellationToken);

    public Task Handle(ActivityLoggedNotification notification, CancellationToken cancellationToken) => SendAsync(notification, cancellationToken);

    public Task Handle(TaskCompletedNotification notification, CancellationToken cancellationToken) => SendAsync(notification, cancellationToken);

    private async Task SendAsync(IRealtimeNotification notification, CancellationToken cancellationToken)
    {
        var message = new RealtimeEventMessage(notification.Type, notification.DealId, notification.OwnerUserId);
        var group = notification.UserScoped && notification.OwnerUserId is { } ownerUserId
            ? DashboardHub.UserGroup(ownerUserId)
            : DashboardHub.OrganizationGroup(notification.OrganizationId);

        try
        {
            await hubContext.Clients.Group(group).SendAsync(DashboardHub.EventMethod, message, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // Sem PII: só o tipo do evento.
            logger.LogWarning(exception, "Falha ao enviar evento de tempo real {EventType}.", notification.Type);
        }
    }
}
