using System.Linq.Expressions;
using Metup.Domain.Deals;

namespace Metup.Application.Deals.Common;

/// <summary>
/// Valor efetivo de um negócio <b>aberto</b>: o valor em negociação ou, na falta dele, o ticket
/// estimado. Fonte única da regra (item 1 do plano do dashboard) para o overview, as tarefas e o
/// pipeline. Receita ganha nunca usa o ticket.
/// </summary>
public static class DealValue
{
    public static decimal? EffectiveAmount(decimal? amount, decimal? ticket) => amount ?? ticket;

    /// <summary>O valor efetivo veio do ticket, não do valor em negociação.</summary>
    public static bool IsEstimated(decimal? amount, decimal? ticket) => amount is null && ticket is not null;

    /// <summary>
    /// Valor que o negócio mostra conforme a situação: aberto = valor efetivo; fechado = só o valor
    /// fechado, nunca estimado (mesma regra da receita ganha).
    /// </summary>
    public static decimal? ForStatus(DealStatus status, decimal? amount, decimal? ticket) =>
        status == DealStatus.Aberto ? EffectiveAmount(amount, ticket) : amount;

    public static bool IsEstimatedForStatus(DealStatus status, decimal? amount, decimal? ticket) =>
        status == DealStatus.Aberto && IsEstimated(amount, ticket);

    /// <summary>
    /// A mesma regra de <see cref="EffectiveAmount"/> e <see cref="IsEstimated"/>, em forma de
    /// expressão, para o banco somar, contar e ordenar (o EF não traduz chamada de método). Monta
    /// uma projeção de <see cref="Deal"/> recebendo, além do negócio, o valor efetivo e se é estimado.
    /// </summary>
    public static Expression<Func<Deal, TResult>> Project<TResult>(
        Expression<Func<Deal, decimal?, bool, TResult>> selector) =>
        Project(d => d.Amount, d => d.Ticket, selector);

    /// <summary>
    /// Mesma projeção para qualquer linha que carregue um valor em negociação e um ticket — por
    /// exemplo, o negócio no instante T (<see cref="DealAtInstant"/>).
    /// </summary>
    public static Expression<Func<TSource, TResult>> Project<TSource, TResult>(
        Expression<Func<TSource, decimal?>> amountOf,
        Expression<Func<TSource, decimal?>> ticketOf,
        Expression<Func<TSource, decimal?, bool, TResult>> selector)
    {
        var source = selector.Parameters[0];
        var amount = new Replacer(amountOf.Parameters[0], source).Visit(amountOf.Body);
        var ticket = new Replacer(ticketOf.Parameters[0], source).Visit(ticketOf.Body);

        var effective = Expression.Coalesce(amount, ticket);
        var estimated = Expression.AndAlso(
            Expression.Equal(amount, Expression.Constant(null, typeof(decimal?))),
            Expression.NotEqual(ticket, Expression.Constant(null, typeof(decimal?))));

        var body = new Replacer(selector.Parameters[1], effective).Visit(selector.Body);
        body = new Replacer(selector.Parameters[2], estimated).Visit(body);
        return Expression.Lambda<Func<TSource, TResult>>(body, source);
    }

    private sealed class Replacer(ParameterExpression from, Expression to) : ExpressionVisitor
    {
        protected override Expression VisitParameter(ParameterExpression node) => node == from ? to : base.VisitParameter(node);
    }
}
