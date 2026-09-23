using System.Security.Claims;
using Metup.Application.Common.Constants;
using Metup.Application.Common.Interfaces;
using Metup.Domain.Users;
using Metup.Server.Security;

namespace Metup.Server.Services;

public class CurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUserService
{
    private ClaimsPrincipal? Principal => httpContextAccessor.HttpContext?.User;

    public Guid? UserId => GetGuidClaim(ClaimTypes.NameIdentifier);

    public Guid? OrganizationId => GetGuidClaim(AppClaimTypes.OrganizationId);

    public IReadOnlySet<Permission> Permissions => UserAccessMiddleware.GetPermissions(httpContextAccessor.HttpContext);

    private Guid? GetGuidClaim(string claimType)
    {
        var value = Principal?.FindFirstValue(claimType);
        return Guid.TryParse(value, out var guid) ? guid : null;
    }
}
