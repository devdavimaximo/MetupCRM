using FluentValidation;
using Metup.Application.Common.Interfaces;

namespace Metup.Application.Tasks.Commands.RescheduleTask;

public class RescheduleTaskCommandValidator : AbstractValidator<RescheduleTaskCommand>
{
    public RescheduleTaskCommandValidator(IOrganizationClock organizationClock)
    {
        RuleFor(x => x.DueDate)
            .MustAsync(async (dueDate, cancellationToken) =>
                dueDate >= (await organizationClock.SnapshotAsync(cancellationToken)).UtcNow)
            .WithMessage("A nova data não pode ser no passado.");
    }
}
