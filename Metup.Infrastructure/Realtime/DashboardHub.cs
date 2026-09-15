using System.Security.Claims;
using Metup.Application.Common.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Metup.Infrastructure.Realtime;

/// <summary>
/// Canal de tempo real das telas (<c>/hubs/dashboard</c>). O client só escuta: nenhum método é
/// chamável daqui. A conexão entra no grupo da organização e no do usuário, lidos das claims do
/// mesmo JWT da API; nunca de algo que o client informe.
///
/// Separado do n8n: integrações continuam na fila <c>IntegrationEvent</c> (seção 5 do CLAUDE.md).
/// </summary>
[Authorize]
public sealed class DashboardHub : Hub
{
    public const string Path = "/hubs/dashboard";

    /// <summary>Nome do método que o client assina.</summary>
    public const string EventMethod = "event";

    public static string OrganizationGroup(Guid organizationId) => $"org:{organizationId:N}";

    public static string UserGroup(Guid userId) => $"user:{userId:N}";

    public override async Task OnConnectedAsync()
    {
        var user = Context.User;
        if (!TryGetGuid(user, AppClaimTypes.OrganizationId, out var organizationId)
            || !TryGetGuid(user, ClaimTypes.NameIdentifier, out var userId))
        {
            Context.Abort();
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, OrganizationGroup(organizationId));
        await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(userId));
        await base.OnConnectedAsync();
    }

    private static bool TryGetGuid(ClaimsPrincipal? user, string claimType, out Guid value) =>
        Guid.TryParse(user?.FindFirstValue(claimType), out value);
}
