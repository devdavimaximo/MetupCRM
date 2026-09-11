using FluentValidation;

namespace Metup.Application.Deals.Commands.UpdateDeal;

public class UpdateDealCommandValidator : AbstractValidator<UpdateDealCommand>
{
    public UpdateDealCommandValidator()
    {
        RuleFor(x => x.OwnerUserId)
            .NotEmpty().WithMessage("Informe o responsável pelo negócio.");

        RuleFor(x => x.Source)
            .IsInEnum().WithMessage("Origem inválida.");

        RuleFor(x => x.Ticket)
            .GreaterThanOrEqualTo(0).WithMessage("O ticket não pode ser negativo.")
            .When(x => x.Ticket.HasValue);

        RuleFor(x => x.Amount)
            .GreaterThanOrEqualTo(0).WithMessage("O valor não pode ser negativo.")
            .When(x => x.Amount.HasValue);
    }
}
