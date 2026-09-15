using Metup.Application.Deals.Common;
using Metup.Domain.Deals;
using FluentValidation;

namespace Metup.Application.Deals.Commands.CreateDeal;

public class CreateDealCommandValidator : AbstractValidator<CreateDealCommand>
{
    public CreateDealCommandValidator()
    {
        RuleFor(x => x.CompanyId)
            .NotEmpty().WithMessage("Informe a empresa do negócio.");

        RuleFor(x => x.OwnerUserId)
            .NotEmpty().WithMessage("Informe o responsável pelo negócio.");

        RuleFor(x => x.Source)
            .IsInEnum().WithMessage("Origem inválida.");

        RuleFor(x => x.InitialStage)
            .IsInEnum().WithMessage("Estágio inválido.")
            .Must(stage => stage is not (DealStage.Ganho or DealStage.Perdido))
            .WithMessage("Um negócio não pode nascer já ganho ou perdido.");

        RuleFor(x => x.Ticket)
            .GreaterThanOrEqualTo(0).WithMessage("O ticket não pode ser negativo.")
            .When(x => x.Ticket.HasValue);

        RuleFor(x => x.Amount)
            .GreaterThanOrEqualTo(0).WithMessage("O valor não pode ser negativo.")
            .When(x => x.Amount.HasValue);

        RuleFor(x => x.ExpectedCloseDate)
            .Must(DealDateRules.IsPlausible).WithMessage("Informe uma previsão de fechamento válida.")
            .When(x => x.ExpectedCloseDate.HasValue);
    }
}
