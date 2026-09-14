using FluentValidation;

namespace Metup.Application.Integrations.Commands.ReceiveMetaAdsLead;

public class ReceiveMetaAdsLeadCommandValidator : AbstractValidator<ReceiveMetaAdsLeadCommand>
{
    public const int MaxNoteLength = 500;

    public ReceiveMetaAdsLeadCommandValidator()
    {
        RuleFor(x => x.ExternalLeadId)
            .NotEmpty().WithMessage("Informe o id do lead no Meta Ads.")
            .MaximumLength(200);

        RuleFor(x => x.CompanyName)
            .NotEmpty().WithMessage("Informe o nome da empresa do lead.")
            .MaximumLength(200);

        RuleFor(x => x.ContactName)
            .NotEmpty().WithMessage("Informe o nome do lead.")
            .MaximumLength(200);

        RuleFor(x => x.Phone).MaximumLength(40);

        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("E-mail inválido.")
            .MaximumLength(320)
            .When(x => !string.IsNullOrWhiteSpace(x.Email));

        RuleFor(x => x.OwnerUserId)
            .NotEmpty().WithMessage("Informe o responsável pelo lead.");

        RuleFor(x => x.Ticket)
            .GreaterThanOrEqualTo(0).WithMessage("O ticket não pode ser negativo.")
            .When(x => x.Ticket.HasValue);

        RuleFor(x => x.Note)
            .MaximumLength(MaxNoteLength).WithMessage($"A nota pode ter no máximo {MaxNoteLength} caracteres.");
    }
}
