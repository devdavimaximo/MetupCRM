using FluentValidation;

namespace Metup.Application.Deals.Commands.ChangeDealStage;

public class ChangeDealStageCommandValidator : AbstractValidator<ChangeDealStageCommand>
{
    public ChangeDealStageCommandValidator()
    {
        RuleFor(x => x.Stage).IsInEnum().WithMessage("Estágio inválido.");

        RuleFor(x => x.ExpectedFromStage)
            .IsInEnum().WithMessage("Estágio de origem inválido.")
            .When(x => x.ExpectedFromStage.HasValue);
    }
}
