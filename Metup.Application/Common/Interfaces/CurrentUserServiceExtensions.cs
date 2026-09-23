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

    public static bool HasPermission(this ICurrentUserService currentUserService, Permission permission) =>
        currentUserService.Permissions.Contains(permission);

    /// <summary>
    /// Ponto único de checagem de permissão nos casos de uso. O controller também restringe; a
    /// checagem aqui garante a regra mesmo se o caso de uso for chamado por outro caminho.
    /// </summary>
    public static void RequirePermission(this ICurrentUserService currentUserService, Permission permission)
    {
        if (!currentUserService.HasPermission(permission))
        {
            throw new ForbiddenAccessException("Você não tem permissão para esta ação.");
        }
    }

    /// <summary>Exige ao menos uma das permissões (ex.: ler cargos serve a quem gerencia usuários ou cargos).</summary>
    public static void RequireAnyPermission(this ICurrentUserService currentUserService, params Permission[] permissions)
    {
        if (!permissions.Any(currentUserService.HasPermission))
        {
            throw new ForbiddenAccessException("Você não tem permissão para esta ação.");
        }
    }

    /// <summary>
    /// Ninguém concede o que não tem: criar/editar cargo ou pôr alguém num cargo exige ter todas as
    /// permissões dele. Impede que quem gerencia usuários se promova a administrador.
    /// </summary>
    public static void RequireCanGrant(this ICurrentUserService currentUserService, IEnumerable<Permission> permissions)
    {
        if (permissions.Any(p => !currentUserService.HasPermission(p)))
        {
            throw new ForbiddenAccessException("Você não pode conceder permissões que o seu cargo não tem.");
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
    /// Escopo do pipeline (quadro, resumo, evolução): a mesma decisão de <see cref="ResolveDealScope"/>,
    /// com os parâmetros da tela. Sem pedido = os negócios do próprio usuário. <paramref name="allOwners"/>
    /// pede a organização; <paramref name="ownerUserId"/> pede a carteira de outra pessoa (e
    /// <paramref name="allOwners"/> vence se vierem os dois). Admin e Closer são atendidos; o SDR é
    /// <b>rebaixado em silêncio</b> para os próprios negócios, como no dashboard. O que valeu volta
    /// em <see cref="DealScopeFilter.OwnerUserId"/> (nulo = todos).
    /// </summary>
    public static DealScopeFilter ResolveDealOwnerScope(
        this ICurrentUserService currentUserService,
        Guid? ownerUserId,
        bool allOwners)
    {
        var userId = currentUserService.RequireUserId();
        var asksForOthers = allOwners || (ownerUserId is { } requested && requested != userId);

        var scope = currentUserService.ResolveDealScope(asksForOthers ? DealScope.Organization : DealScope.Mine);

        return scope.AppliedScope == DealScope.Organization && !allOwners && ownerUserId is { } owner
            ? scope with { OwnerUserId = owner }
            : scope;
    }

    /// <summary>
    /// Ponto único de decisão de "em quais negócios este usuário pode agir" (mudar etapa, fechar,
    /// editar, reatribuir), no molde de <see cref="ResolveTaskActionScope"/>. Admin e Closer agem em
    /// qualquer negócio da organização; o SDR só nos próprios — e agir no negócio de outro é
    /// <b>recusado</b> (403), não rebaixado. Leitura (<c>GetDealById</c>, <c>ListDeals</c>) continua
    /// aberta à organização inteira: quem já viu o negócio numa lista não passa a receber 404 nela.
    /// </summary>
    public static DealScopeFilter ResolveDealActionScope(this ICurrentUserService currentUserService)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        return currentUserService.ReachesOrganization()
            ? new DealScopeFilter(organizationId, null, DealScope.Organization)
            : new DealScopeFilter(organizationId, userId, DealScope.Mine);
    }

    /// <summary>Reatribuir negócio: só Admin/Closer, como em Tarefas.</summary>
    public static void RequireDealReassign(this ICurrentUserService currentUserService)
    {
        if (!currentUserService.ReachesOrganization())
        {
            throw new ForbiddenAccessException("Sem permissão para reatribuir negócios.");
        }
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

    /// <summary>
    /// Ponto único de decisão de "em quais tarefas este usuário pode agir" (concluir, cancelar,
    /// reagendar, reatribuir, ações em massa, concluir ao registrar atividade). Admin e Closer agem em
    /// qualquer tarefa da organização; o SDR só nas próprias. Quem chama decide o que fazer com a
    /// tarefa fora do escopo: 403 na ação por linha, <c>NotFound</c> por item no lote.
    /// </summary>
    public static TaskOwnerFilter ResolveTaskActionScope(this ICurrentUserService currentUserService)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        return new TaskOwnerFilter(organizationId, currentUserService.ReachesOrganization() ? null : userId);
    }

    /// <summary>Reatribuir tarefa: só Admin/Closer. Mesmo critério de "alcança a organização".</summary>
    public static void RequireTaskReassign(this ICurrentUserService currentUserService)
    {
        if (!currentUserService.ReachesOrganization())
        {
            throw new ForbiddenAccessException("Sem permissão para reatribuir tarefas.");
        }
    }

    /// <summary>
    /// Alcança a organização inteira quem tem <see cref="Permission.TeamWideAccess"/> (nos cargos
    /// padrão: Administrador e Closer). Nas descrições acima, "Admin/Closer" = com essa permissão e
    /// "SDR" = sem ela.
    /// </summary>
    private static bool ReachesOrganization(this ICurrentUserService currentUserService) =>
        currentUserService.HasPermission(Permission.TeamWideAccess);
}
