using FluentValidation;
using Metup.Application.Users.Common;

namespace Metup.Application.Users.Commands.UpdateUser;

public class UpdateUserCommandValidator : AbstractValidator<UpdateUserCommand>
{
    public UpdateUserCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Informe o usuário.");
        RuleFor(x => x.Name).ValidUserName();
        RuleFor(x => x.Email).ValidUserEmail();
        RuleFor(x => x.RoleId).ValidRoleId();
    }
}
