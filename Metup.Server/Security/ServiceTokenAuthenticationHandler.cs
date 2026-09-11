using System.Security.Claims;
using System.Text.Encodings.Web;
using Metup.Application.Common.Constants;
using Metup.Application.Common.Interfaces;
using Metup.Application.Integrations.Common;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Metup.Server.Security;

/// <summary>
/// Esquema de autenticação do n8n: o header <see cref="TokenHeaderName"/> traz um service token
/// por organização ("{organizationId}.{secret}", ver <see cref="ServiceTokenFormat"/>). Sucesso
/// vira só a claim de organização — <see cref="ICurrentUserService.RequireOrganizationId"/>
/// funciona sem mudança nenhuma nos handlers de ingestão/fila, absorvendo o n8n como um novo
/// tipo de chamador no mesmo ponto central de escopo (regra 4.1 do CLAUDE.md).
/// </summary>
public class ServiceTokenAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IApplicationDbContext context,
    IPasswordHasher passwordHasher) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "ServiceToken";
    public const string TokenHeaderName = "X-Service-Token";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(TokenHeaderName, out var headerValue))
        {
            return AuthenticateResult.NoResult();
        }

        if (!ServiceTokenFormat.TryParse(headerValue.ToString(), out var organizationId, out var secret))
        {
            return AuthenticateResult.Fail("Service token inválido.");
        }

        var tokenHash = await context.Organizations
            .AsNoTracking()
            .Where(o => o.Id == organizationId)
            .Select(o => o.IntegrationTokenHash)
            .FirstOrDefaultAsync();

        if (tokenHash is null || !passwordHasher.Verify(tokenHash, secret))
        {
            return AuthenticateResult.Fail("Service token inválido.");
        }

        var claims = new[] { new Claim(AppClaimTypes.OrganizationId, organizationId.ToString()) };
        var identity = new ClaimsIdentity(claims, SchemeName);
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName);

        return AuthenticateResult.Success(ticket);
    }
}
