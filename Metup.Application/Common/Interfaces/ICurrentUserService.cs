using Metup.Domain.Users;

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

    /// <summary>
    /// Permissões efetivas do cargo do usuário, lidas do banco a cada requisição (mudar o cargo vale
    /// na hora, sem novo login). Vazio para o service token do n8n e para quem não está logado.
    /// </summary>
    IReadOnlySet<Permission> Permissions { get; }
}
