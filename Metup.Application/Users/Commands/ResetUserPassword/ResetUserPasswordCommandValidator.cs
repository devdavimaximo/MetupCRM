using FluentValidation;
using Metup.Application.Users.Common;

namespace Metup.Application.Users.Commands.ResetUserPassword;

public class ResetUserPasswordCommandValidator : AbstractValidator<ResetUserPasswordCommand>
{
    public ResetUserPasswordCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Informe o usuário.");
        RuleFor(x => x.Password).ValidPassword();
    }
}
