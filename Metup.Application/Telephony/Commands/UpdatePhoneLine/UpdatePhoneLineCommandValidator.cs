using FluentValidation;
using Metup.Application.Common.Extensions;
using Metup.Application.Telephony.Common;
using Metup.Domain.Telephony;

namespace Metup.Application.Telephony.Commands.UpdatePhoneLine;

public class UpdatePhoneLineCommandValidator : AbstractValidator<UpdatePhoneLineCommand>
{
    public UpdatePhoneLineCommandValidator()
    {
        RuleFor(x => x.Label)
            .NotEmpty().WithMessage("Dê um nome à linha.")
            .MaximumLength(PhoneLine.LabelMaxLength).WithMessage($"O nome pode ter no máximo {PhoneLine.LabelMaxLength} caracteres.");

        RuleFor(x => x.Number)
            .NotEmpty().WithMessage("Informe o número da linha.")
            .MaximumLength(PhoneLine.NumberMaxLength).WithMessage($"O número pode ter no máximo {PhoneLine.NumberMaxLength} caracteres.")
            .Must(n => n.ToBrazilianE164() is not null).WithMessage(PhoneLineRules.NumberFormatMessage);
    }
}
