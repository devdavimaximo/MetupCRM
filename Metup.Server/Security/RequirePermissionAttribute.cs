using Metup.Application.Common.Interfaces;
using Metup.Domain.Users;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Metup.Server.Security;

/// <summary>
/// Restringe o controller/ação a quem tem ao menos uma das permissões. Usar junto de
/// <c>[Authorize]</c>. Os casos de uso sensíveis checam de novo (<c>RequirePermission</c>).
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class RequirePermissionAttribute(params Permission[] permissions) : Attribute, IAuthorizationFilter
{
    public IReadOnlyList<Permission> Permissions { get; } = permissions;

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        if (context.HttpContext.User.Identity?.IsAuthenticated != true)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var currentUser = context.HttpContext.RequestServices.GetRequiredService<ICurrentUserService>();
        if (Permissions.Any(currentUser.HasPermission))
        {
            return;
        }

        context.Result = new ObjectResult(new ProblemDetails
        {
            Status = StatusCodes.Status403Forbidden,
            Title = "Você não tem permissão para acessar este recurso.",
        })
        {
            StatusCode = StatusCodes.Status403Forbidden,
        };
    }
}
