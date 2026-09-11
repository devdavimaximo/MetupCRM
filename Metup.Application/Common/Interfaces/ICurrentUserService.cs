namespace Metup.Application.Common.Interfaces;

/// <summary>
/// Ponto central de resolução de identidade/escopo (regra 4.1 do CLAUDE.md).
/// Todo caso de uso que precisa escopar dados por organização deve depender
/// desta interface em vez de receber OrganizationId do client.
/// </summary>
public interface ICurrentUserService
{
    Guid? UserId { get; }

    Guid? OrganizationId { get; }

    string? Role { get; }
}
