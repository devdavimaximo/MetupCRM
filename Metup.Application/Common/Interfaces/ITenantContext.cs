namespace Metup.Application.Common.Interfaces;

/// <summary>
/// A organização cujos dados esta unidade de trabalho enxerga (regra 4.1 do CLAUDE.md). O contexto
/// do EF aplica um filtro global com ela em toda entidade de negócio: nenhum handler precisa lembrar
/// do <c>Where(OrganizationId == …)</c> para não vazar dado de outra organização.
///
/// Nulo = ninguém resolvido (requisição anônima, login antes de achar o usuário): o filtro fecha e
/// nenhuma linha volta. Ler entre organizações é exceção explícita — ver
/// <see cref="TenantQueryExtensions.AcrossOrganizations{T}"/>.
/// </summary>
public interface ITenantContext
{
    Guid? OrganizationId { get; }
}
