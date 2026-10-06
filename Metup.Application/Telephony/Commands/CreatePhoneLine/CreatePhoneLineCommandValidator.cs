using FluentValidation;
using Metup.Application.Common.Extensions;
using Metup.Application.Telephony.Common;
using Metup.Domain.Telephony;

namespace Metup.Application.Telephony.Commands.CreatePhoneLine;

public class CreatePhoneLineCommandValidator : AbstractValidator<CreatePhoneLineCommand>
{
    public CreatePhoneLineCommandValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty().WithMessage("Informe o usuário da linha.");

        RuleFor(x => x.Kind)
            .IsInEnum().WithMessage("Tipo de linha inválido.");

        RuleFor(x => x.Label)
            .NotEmpty().WithMessage("Dê um nome à linha.")
            .MaximumLength(PhoneLine.LabelMaxLength).WithMessage($"O nome pode ter no máximo {PhoneLine.LabelMaxLength} caracteres.");

        RuleFor(x => x.Number)
            .NotEmpty().WithMessage("Informe o número da linha.")
            .MaximumLength(PhoneLine.NumberMaxLength).WithMessage($"O número pode ter no máximo {PhoneLine.NumberMaxLength} caracteres.")
            .Must(n => n.ToBrazilianE164() is not null).WithMessage(PhoneLineRules.NumberFormatMessage);
    }
}
