using Metup.Application.Notifications.Common;
using MediatR;

namespace Metup.Application.Notifications.Queries.GetNotifications;

/// <summary>As notificações do usuário logado, da mais recente para a mais antiga.</summary>
public record GetNotificationsQuery : IRequest<IReadOnlyList<NotificationDto>>
{
    public static readonly TimeSpan DueSoonWindow = TimeSpan.FromMinutes(60);
    public static readonly TimeSpan AwaitingReplyAfter = TimeSpan.FromMinutes(30);

    /// <summary>Teto por regra: o sino é aviso, não lista de trabalho (essa é a tela de Tarefas).</summary>
    public const int MaxPerKind = 20;
}
