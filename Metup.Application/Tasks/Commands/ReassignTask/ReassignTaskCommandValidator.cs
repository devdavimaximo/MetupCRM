using FluentValidation;

namespace Metup.Application.Tasks.Commands.ReassignTask;

public class ReassignTaskCommandValidator : AbstractValidator<ReassignTaskCommand>
{
    public ReassignTaskCommandValidator()
    {
        RuleFor(x => x.OwnerUserId)
            .NotEmpty().WithMessage("Informe o novo responsável.");
    }
}
