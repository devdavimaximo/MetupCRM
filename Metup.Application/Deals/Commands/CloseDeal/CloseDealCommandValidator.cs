using FluentValidation;

namespace Metup.Application.Deals.Commands.CloseDeal;

public class CloseDealCommandValidator : AbstractValidator<CloseDealCommand>
{
    public CloseDealCommandValidator()
    {
        RuleFor(x => x.ClosedAmount)
            .GreaterThanOrEqualTo(0).WithMessage("O valor fechado não pode ser negativo.")
            .When(x => x.ClosedAmount.HasValue);
    }
}
