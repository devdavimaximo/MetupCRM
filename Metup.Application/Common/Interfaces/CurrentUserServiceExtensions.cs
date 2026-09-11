using Metup.Application.Common.Exceptions;

namespace Metup.Application.Common.Interfaces;

public static class CurrentUserServiceExtensions
{
    /// <summary>
    /// Ponto único de leitura do escopo de organização nos casos de uso.
    /// Nenhum handler deve aceitar OrganizationId vindo do client (regra 4.1 do CLAUDE.md).
    /// </summary>
    public static Guid RequireOrganizationId(this ICurrentUserService currentUserService) =>
        currentUserService.OrganizationId ?? throw new MissingOrganizationScopeException();
}
