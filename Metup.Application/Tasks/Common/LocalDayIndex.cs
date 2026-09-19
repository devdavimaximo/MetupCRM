using System.Linq.Expressions;
using Metup.Application.Common.Models;
using Metup.Domain.Tasks;

namespace Metup.Application.Tasks.Common;

/// <summary>
/// Agrupamento no banco pelo dia local: a chave é a posição do dia numa série, decidida pelas
/// fronteiras de dia (00:00 locais, em UTC) — certo mesmo em dia com troca de horário de verão, que
/// um deslocamento fixo erraria. Usado pela série de concluídas do resumo e pelo calendário.
/// </summary>
public static class LocalDayIndex
{
    /// <summary>Os inícios de <paramref name="days"/> dias locais a partir de <paramref name="firstDay"/>, mais o do dia seguinte ao último.</summary>
    public static DateTime[] DayStarts(OrganizationClockSnapshot clock, DateOnly firstDay, int days) =>
        Enumerable.Range(0, days + 1)
            .Select(i => clock.StartOfDayUtc(firstDay.AddDays(i)))
            .ToArray();

    /// <summary>
    /// <c>instante &lt; início do dia 1 ? 0 : instante &lt; início do dia 2 ? 1 : …</c> — vira um
    /// <c>CASE WHEN</c> no SQL. Só deve ser aplicado com o instante já dentro da janela.
    /// </summary>
    public static Expression<Func<TaskItem, int>> Of<TInstant>(
        Expression<Func<TaskItem, TInstant>> instant,
        IReadOnlyList<DateTime> dayStarts)
    {
        var task = instant.Parameters[0];
        var value = instant.Body;

        Expression index = Expression.Constant(dayStarts.Count - 2);
        for (var day = dayStarts.Count - 3; day >= 0; day--)
        {
            var nextDayStart = Expression.Constant(Convert(dayStarts[day + 1], value.Type), value.Type);
            index = Expression.Condition(Expression.LessThan(value, nextDayStart), Expression.Constant(day), index);
        }

        return Expression.Lambda<Func<TaskItem, int>>(index, task);
    }

    private static object Convert(DateTime value, Type type) => type == typeof(DateTime?) ? (DateTime?)value : value;
}
