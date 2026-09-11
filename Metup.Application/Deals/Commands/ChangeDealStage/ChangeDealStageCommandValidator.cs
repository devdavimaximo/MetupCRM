using FluentValidation;

namespace Metup.Application.Deals.Commands.ChangeDealStage;

public class ChangeDealStageCommandValidator : AbstractValidator<ChangeDealStageCommand>
{
    public ChangeDealStageCommandValidator()
    {
        RuleFor(x => x.Stage).IsInEnum().WithMessage("Estágio inválido.");
    }
}
