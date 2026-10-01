using Metup.Application.Common.Interfaces;

namespace Metup.Infrastructure.Persistence;

/// <summary>
/// Tenant da requisição: a organização do chamador autenticado — usuário (claim do JWT) ou n8n (claim
/// do service token). Lida a cada consulta, não na construção do contexto: o filtro vale com a
/// identidade que a autenticação resolveu.
/// </summary>
public sealed class CurrentUserTenantContext(ICurrentUserService currentUserService) : ITenantContext
{
    public Guid? OrganizationId => currentUserService.OrganizationId;
}

/// <summary>
/// Tenant fixo, para quem abre o contexto fora de uma requisição (ferramentas, testes e, adiante,
/// jobs em background): a organização é escolha explícita de quem constrói. Nulo fecha o filtro —
/// serve para ler só <c>Organization</c>, que não é entidade de negócio.
/// </summary>
public sealed class FixedTenantContext(Guid? organizationId) : ITenantContext
{
    public static readonly FixedTenantContext None = new(null);

    public Guid? OrganizationId { get; } = organizationId;
}
