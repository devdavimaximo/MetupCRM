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

        return requestedScope == DealScope.Organization && currentUserService.ReachesOrganization()
            ? new DealScopeFilter(organizationId, null, DealScope.Organization)
            : new DealScopeFilter(organizationId, userId, DealScope.Mine);
    }

    /// <summary>
    /// Ponto único de decisão de "de quem são as tarefas" — listagem, resumo, criação e, nas próximas
    /// ondas, calendário e ações em massa. Sem pedido = as do próprio usuário. Pedir outro responsável
    /// (<paramref name="ownerUserId"/>) ou todos (<paramref name="allOwners"/>) só vale para
    /// Admin/Closer. Diferente de <see cref="ResolveDealScope"/>, o pedido não permitido é
    /// <b>recusado</b> (403), não rebaixado: a tela de tarefas já pedia um responsável explícito e
    /// devolver as tarefas de outra pessoa em silêncio seria enganoso.
    /// </summary>
    public static TaskOwnerFilter ResolveTaskOwnerScope(
        this ICurrentUserService currentUserService,
        Guid? ownerUserId = null,
        bool allOwners = false)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        var asksForOthers = allOwners || (ownerUserId is { } requested && requested != userId);
        if (asksForOthers && !currentUserService.ReachesOrganization())
        {
            throw new ForbiddenAccessException("Sem permissão para ver as tarefas de outro usuário.");
        }

        return allOwners
            ? new TaskOwnerFilter(organizationId, null)
            : new TaskOwnerFilter(organizationId, ownerUserId ?? userId);
    }

    /// <summary>Admin e Closer alcançam a organização inteira; SDR e papel desconhecido, não.</summary>
    private static bool ReachesOrganization(this ICurrentUserService currentUserService) =>
        Enum.TryParse<UserRole>(currentUserService.Role, out var role)
            && role is UserRole.Admin or UserRole.Closer;
}
