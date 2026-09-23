using System.Security.Claims;
using Metup.Application.Common.Constants;
using Metup.Application.Common.Interfaces;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace Metup.Server.Security;

/// <summary>
/// Resolve, a cada requisição de usuário logado, se ele continua ativo e quais permissões o cargo
/// dele dá. Vem do banco, não do JWT: desativar alguém ou mudar um cargo vale na hora, sem esperar
/// o token expirar. O resultado fica no <see cref="HttpContext.Items"/> e é lido pelo
/// <c>CurrentUserService</c> — o ponto central de autorização continua sendo um só.
/// </summary>
public class UserAccessMiddleware(RequestDelegate next)
{
    private const string ItemKey = "metup.user-permissions";

    public static IReadOnlySet<Permission> GetPermissions(HttpContext? httpContext) =>
        httpContext?.Items[ItemKey] as IReadOnlySet<Permission> ?? EmptyPermissions;

    private static readonly IReadOnlySet<Permission> EmptyPermissions = new HashSet<Permission>();

    public async Task InvokeAsync(HttpContext httpContext, IApplicationDbContext context)
    {
        var principal = httpContext.User;
        var userIdClaim = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        var organizationIdClaim = principal.FindFirstValue(AppClaimTypes.OrganizationId);

        // Service token do n8n (só organização) e requisições anônimas seguem sem permissões de usuário.
        if (principal.Identity?.IsAuthenticated != true
            || !Guid.TryParse(userIdClaim, out var userId)
            || !Guid.TryParse(organizationIdClaim, out var organizationId))
        {
            await next(httpContext);
            return;
        }

        var access = await context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId && u.OrganizationId == organizationId && u.IsActive)
            .Join(context.Roles, u => u.RoleId, r => r.Id, (_, r) => new { r.IsAdministrator, r.Permissions })
            .FirstOrDefaultAsync(httpContext.RequestAborted);

        if (access is null)
        {
            // Desativado (ou removido) com token ainda válido: a sessão acaba aqui.
            httpContext.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        httpContext.Items[ItemKey] = access.IsAdministrator
            ? new HashSet<Permission>(Enum.GetValues<Permission>())
            : new HashSet<Permission>(access.Permissions);

        await next(httpContext);
    }
}
