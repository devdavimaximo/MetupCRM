using System.Security.Claims;
using Metup.Application.Common.Constants;
using Metup.Application.Common.Interfaces;

namespace Metup.Server.Services;

public class CurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUserService
{
    private ClaimsPrincipal? Principal => httpContextAccessor.HttpContext?.User;

    public Guid? UserId => GetGuidClaim(ClaimTypes.NameIdentifier);

    public Guid? OrganizationId => GetGuidClaim(AppClaimTypes.OrganizationId);

    public string? Role => Principal?.FindFirstValue(ClaimTypes.Role);

    private Guid? GetGuidClaim(string claimType)
    {
        var value = Principal?.FindFirstValue(claimType);
        return Guid.TryParse(value, out var guid) ? guid : null;
    }
}
