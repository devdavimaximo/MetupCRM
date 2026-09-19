using FluentValidation;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;

namespace Metup.Application.Common.Validation;

/// <summary>
/// Regras do intervalo local <c>from</c>–<c>to</c> (inclusive): os dois ou nenhum, em ordem, até
/// <see cref="LocalPeriod.MaxDays"/> dias e sem terminar no futuro — as mesmas do dashboard.
/// </summary>
public static class LocalPeriodRules
{
    public static void AddLocalPeriodRules<T>(
        this AbstractValidator<T> validator,
        Func<T, DateOnly?> from,
        Func<T, DateOnly?> to,
        IOrganizationClock organizationClock)
    {
        validator.RuleFor(x => x)
            .Must(x => from(x).HasValue == to(x).HasValue)
            .WithName("Período")
            .WithMessage("Informe a data inicial e a final do período.");

        validator.When(x => from(x).HasValue && to(x).HasValue, () =>
        {
            validator.RuleFor(x => x)
                .Must(x => from(x) <= to(x))
                .WithName("Período")
                .WithMessage("A data inicial deve ser anterior ou igual à final.");

            validator.RuleFor(x => x)
                .Must(x => to(x)!.Value.DayNumber - from(x)!.Value.DayNumber + 1 <= LocalPeriod.MaxDays)
                .WithName("Período")
                .WithMessage($"O período pode ter no máximo {LocalPeriod.MaxDays} dias.");

            validator.RuleFor(x => x)
                .MustAsync(async (x, cancellationToken) =>
                    to(x) <= (await organizationClock.SnapshotAsync(cancellationToken)).Today)
                .WithName("Período")
                .WithMessage("A data final não pode estar no futuro.");
        });
    }
}
