using FluentValidation;

namespace Metup.Application.Tasks.Commands.RescheduleTask;

public class RescheduleTaskCommandValidator : AbstractValidator<RescheduleTaskCommand>
{
    public RescheduleTaskCommandValidator()
    {
        RuleFor(x => x.DueDate)
            .GreaterThanOrEqualTo(DateTime.UtcNow).WithMessage("A nova data não pode ser no passado.");
    }
}
