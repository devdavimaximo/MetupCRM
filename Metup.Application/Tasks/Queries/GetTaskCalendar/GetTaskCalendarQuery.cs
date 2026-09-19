using System.Globalization;
using Metup.Application.Tasks.Common;
using MediatR;

namespace Metup.Application.Tasks.Queries.GetTaskCalendar;

/// <summary>Pontos do calendário lateral: só os dias do mês com tarefa pendente, no fuso da organização.</summary>
/// <param name="Month">Mês local no formato <c>YYYY-MM</c>.</param>
public record GetTaskCalendarQuery(string Month, Guid? OwnerUserId, bool AllOwners) : IRequest<IReadOnlyList<TaskCalendarDayDto>>
{
    public const string MonthFormat = "yyyy-MM";

    public static bool TryParseMonth(string? month, out DateOnly firstDay) =>
        DateOnly.TryParseExact(month, MonthFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out firstDay);
}
