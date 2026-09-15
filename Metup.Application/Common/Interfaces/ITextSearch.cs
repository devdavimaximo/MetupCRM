using System.Linq.Expressions;

namespace Metup.Application.Common.Interfaces;

/// <summary>
/// Filtro de texto "contém o termo", sem diferenciar maiúsculas nem acentos ("sao paulo" encontra
/// "São Paulo"). Fica atrás de interface porque a forma de comparar é do banco (no Postgres,
/// <c>unaccent</c> + <c>ILIKE</c>): os casos de uso continuam sem depender de provedor.
/// </summary>
public interface ITextSearch
{
    /// <summary>Mantém as linhas em que <b>algum</b> dos campos contém o termo.</summary>
    IQueryable<T> WhereAnyContains<T>(IQueryable<T> source, string term, params Expression<Func<T, string?>>[] fields);
}
