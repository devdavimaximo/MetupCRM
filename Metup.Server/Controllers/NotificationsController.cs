using Metup.Application.Notifications.Common;
using Metup.Application.Notifications.Queries.GetNotifications;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>Notificações derivadas do usuário logado (tarefas, negócios parados, conversas sem resposta).</remarks>
[ApiController]
[Authorize]
[Route("api/notifications")]
public class NotificationsController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<NotificationDto>>> List(CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetNotificationsQuery(), cancellationToken));
}
