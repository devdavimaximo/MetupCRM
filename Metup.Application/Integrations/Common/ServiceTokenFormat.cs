namespace Metup.Application.Integrations.Common;

/// <summary>
/// Formato do service token do n8n: "{organizationId}.{secret}". O prefixo deixa a organização
/// identificável sem precisar varrer todas pra achar qual hash bate — só o secret é validado
/// contra o hash guardado (<see cref="Metup.Domain.Organizations.Organization.IntegrationTokenHash"/>).
/// Compartilhado entre quem emite o token (RotateIntegrationToken) e quem autentica com ele
/// (ServiceTokenAuthenticationHandler, no Metup.Server).
/// </summary>
public static class ServiceTokenFormat
{
    public static string Combine(Guid organizationId, string secret) => $"{organizationId}.{secret}";

    public static bool TryParse(string? token, out Guid organizationId, out string secret)
    {
        organizationId = Guid.Empty;
        secret = string.Empty;

        if (string.IsNullOrWhiteSpace(token))
        {
            return false;
        }

        var separatorIndex = token.IndexOf('.');
        if (separatorIndex <= 0 || separatorIndex == token.Length - 1)
        {
            return false;
        }

        if (!Guid.TryParse(token[..separatorIndex], out organizationId))
        {
            return false;
        }

        secret = token[(separatorIndex + 1)..];
        return true;
    }
}
