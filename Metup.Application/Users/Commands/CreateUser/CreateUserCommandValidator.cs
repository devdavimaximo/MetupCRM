using FluentValidation;
using Metup.Application.Users.Common;

namespace Metup.Application.Users.Commands.CreateUser;

public class CreateUserCommandValidator : AbstractValidator<CreateUserCommand>
{
    public CreateUserCommandValidator()
    {
        RuleFor(x => x.Name).ValidUserName();
        RuleFor(x => x.Email).ValidUserEmail();
        RuleFor(x => x.Password).ValidPassword();
        RuleFor(x => x.RoleId).ValidRoleId();
    }
}
