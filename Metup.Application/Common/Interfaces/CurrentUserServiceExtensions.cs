using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Models;
using Metup.Domain.Users;

namespace Metup.Application.Common.Interfaces;

public static class CurrentUserServiceExtensions
{
    /// <summary>
    /// Ponto único de leitura do escopo de organização nos casos de uso.
    /// Nenhum handler deve aceitar OrganizationId vindo do client (regra 4.1 do CLAUDE.md).
    /// </summary>
    public static Guid RequireOrganizationId(this ICurrentUserService currentUserService) =>
        currentUserService.OrganizationId ?? throw new MissingOrganizationScopeException();

    /// <summary>Ponto único de leitura do autor da ação (quem registrou a mudança) nos casos de uso.</summary>
    public static Guid RequireUserId(this ICurrentUserService currentUserService) =>
        currentUserService.UserId ?? throw new MissingUserContextException();

    /// <summary>
    /// Ponto único de checagem de papel nos casos de uso. O controller também restringe o papel; a
    /// checagem aqui garante a regra mesmo se o caso de uso for chamado por outro caminho.
    /// </summary>
    public static void RequireRole(this ICurrentUserService currentUserService, UserRole requiredRole)
    {
        if (!Enum.TryParse<UserRole>(currentUserService.Role, out var role) || role != requiredRole)
        {
            throw new ForbiddenAccessException("Você não tem permissão para esta ação.");
        }
    }

    /// <summary>
    /// Ponto único de decisão de "quais negócios este usuário enxerga" — nenhum handler interpreta
    /// papel por conta própria. Admin e Closer alcançam a organização inteira; o SDR fica restrito
    /// aos negócios sob sua responsabilidade. Um escopo pedido além do permitido (ou um papel
    /// desconhecido) é rebaixado em silêncio para o escopo do próprio usuário.
    /// </summary>
    public static DealScopeFilter ResolveDealScope(
        this ICurrentUserService currentUserService,
        DealScope requestedScope = DealScope.Organization)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        var reachesOrganization = Enum.TryParse<UserRole>(currentUserService.Role, out var role)
            && role is UserRole.Admin or UserRole.Closer;

        return requestedScope == DealScope.Organization && reachesOrganization
            ? new DealScopeFilter(organizationId, null, DealScope.Organization)
            : new DealScopeFilter(organizationId, userId, DealScope.Mine);
    }
}
