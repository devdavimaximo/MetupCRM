using System.Linq.Expressions;
using System.Reflection;
using Metup.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Metup.Infrastructure.Search;

/// <summary>
/// "Contém" sem maiúsculas nem acentos no Postgres: <c>unaccent(campo) ILIKE unaccent('%termo%')</c>.
/// Depende da extensão <c>unaccent</c> (migration <c>EnableUnaccent</c>). Os curingas do termo
/// (<c>%</c>, <c>_</c>, <c>\</c>) são escapados: quem busca "50%" procura o texto "50%".
/// </summary>
public sealed class NpgsqlTextSearch : ITextSearch
{
    private static readonly MethodInfo ILikeMethod = typeof(NpgsqlDbFunctionsExtensions)
        .GetMethod(nameof(NpgsqlDbFunctionsExtensions.ILike), [typeof(DbFunctions), typeof(string), typeof(string)])!;

    private static readonly MethodInfo UnaccentMethod = typeof(NpgsqlFullTextSearchDbFunctionsExtensions)
        .GetMethod(nameof(NpgsqlFullTextSearchDbFunctionsExtensions.Unaccent), [typeof(DbFunctions), typeof(string)])!;

    private static readonly Expression Functions = Expression.Constant(EF.Functions, typeof(DbFunctions));

    public IQueryable<T> WhereAnyContains<T>(IQueryable<T> source, string term, params Expression<Func<T, string?>>[] fields)
    {
        if (fields.Length == 0)
        {
            return source;
        }

        var parameter = Expression.Parameter(typeof(T), "row");
        // O padrão vai como variável capturada (parâmetro SQL), nunca concatenado no texto da query.
        var holder = new PatternHolder($"%{Escape(term)}%");
        var pattern = Expression.Call(UnaccentMethod, Functions, Expression.Property(Expression.Constant(holder), nameof(PatternHolder.SearchPattern)));

        Expression? body = null;
        foreach (var field in fields)
        {
            var value = new ParameterReplacer(field.Parameters[0], parameter).Visit(field.Body);
            var match = Expression.Call(ILikeMethod, Functions, Expression.Call(UnaccentMethod, Functions, value), pattern);
            body = body is null ? match : Expression.OrElse(body, match);
        }

        return source.Where(Expression.Lambda<Func<T, bool>>(body!, parameter));
    }

    private static string Escape(string term) =>
        term.Replace(@"\", @"\\").Replace("%", @"\%").Replace("_", @"\_");

    private sealed record PatternHolder(string SearchPattern);

    private sealed class ParameterReplacer(ParameterExpression from, ParameterExpression to) : ExpressionVisitor
    {
        protected override Expression VisitParameter(ParameterExpression node) => node == from ? to : base.VisitParameter(node);
    }
}
