using FluentValidation;
using Metup.Application.Users.Common;

namespace Metup.Application.Roles.Commands.CreateRole;

public class CreateRoleCommandValidator : AbstractValidator<CreateRoleCommand>
{
    public CreateRoleCommandValidator()
    {
        RuleFor(x => x.Name).ValidRoleName();
        RuleFor(x => x.Description).ValidRoleDescription();
        RuleFor(x => x.Permissions).ValidPermissions();
    }
}
