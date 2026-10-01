using Metup.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Common.Interfaces;

/// <summary>
/// O filtro global de organização e a <b>única</b> porta para atravessá-lo. Um teste de arquitetura
/// garante que <c>IgnoreQueryFilters</c> não aparece em nenhum outro arquivo: toda leitura entre
/// organizações passa por aqui e é encontrável com uma busca por <see cref="AcrossOrganizations{T}"/>.
/// </summary>
public static class TenantQueryExtensions
{
    /// <summary>Nome do filtro global registrado pelo contexto do EF em toda entidade de negócio.</summary>
    public const string TenantFilterName = "Tenant";

    /// <summary>
    /// Lê sem o filtro de organização. Só para o que acontece <b>antes</b> de existir uma organização
    /// resolvida e é global por definição — achar o usuário pelo e-mail no login, garantir e-mail único
    /// entre organizações. Quem usa assume o escopo: filtra a organização à mão quando ela já é
    /// conhecida e nunca devolve ao chamador dado de outra organização.
    /// </summary>
    public static IQueryable<T> AcrossOrganizations<T>(this IQueryable<T> source)
        where T : BaseEntity =>
        source.IgnoreQueryFilters([TenantFilterName]);
}
