using FluentValidation;
using Metup.Application.Common.Interfaces;

namespace Metup.Application.Tasks.Queries.GetTaskCalendar;

public class GetTaskCalendarQueryValidator : AbstractValidator<GetTaskCalendarQuery>
{
    public const int MaxMonthsAway = 24;

    public GetTaskCalendarQueryValidator(IOrganizationClock organizationClock)
    {
        RuleFor(x => x.Month)
            .Must(month => GetTaskCalendarQuery.TryParseMonth(month, out _))
            .WithMessage("Mês inválido. Use o formato AAAA-MM.");

        RuleFor(x => x.Month)
            .MustAsync(async (month, cancellationToken) =>
            {
                var today = (await organizationClock.SnapshotAsync(cancellationToken)).Today;
                GetTaskCalendarQuery.TryParseMonth(month, out var firstDay);
                var monthsAway = (firstDay.Year - today.Year) * 12 + firstDay.Month - today.Month;
                return Math.Abs(monthsAway) <= MaxMonthsAway;
            })
            .WithMessage($"O calendário alcança até {MaxMonthsAway} meses antes ou depois de hoje.")
            .When(x => GetTaskCalendarQuery.TryParseMonth(x.Month, out _));
    }
}
