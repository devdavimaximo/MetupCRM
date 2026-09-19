using FluentValidation;
using Metup.Domain.Deals;

namespace Metup.Application.Deals.Commands.CloseDeal;

public class CloseDealCommandValidator : AbstractValidator<CloseDealCommand>
{
    public CloseDealCommandValidator()
    {
        RuleFor(x => x.ClosedAmount)
            .GreaterThanOrEqualTo(0).WithMessage("O valor fechado não pode ser negativo.")
            .When(x => x.ClosedAmount.HasValue);

        When(x => x.Won, () =>
        {
            RuleFor(x => x.LostReason)
                .Null().WithMessage("Negócio ganho não tem motivo de perda.");

            RuleFor(x => x.LostNote)
                .Must(string.IsNullOrWhiteSpace).WithMessage("Negócio ganho não tem observação de perda.");
        });

        When(x => !x.Won, () =>
        {
            RuleFor(x => x.LostReason)
                .NotNull().WithMessage("Informe o motivo da perda.")
                .IsInEnum().WithMessage("Motivo de perda inválido.");

            RuleFor(x => x.LostNote)
                .Must(note => note is null || note.Trim().Length <= Deal.LostNoteMaxLength)
                .WithMessage($"A observação pode ter no máximo {Deal.LostNoteMaxLength} caracteres.");
        });
    }
}
