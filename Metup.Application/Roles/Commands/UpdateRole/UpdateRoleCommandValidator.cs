using FluentValidation;
using Metup.Application.Users.Common;

namespace Metup.Application.Roles.Commands.UpdateRole;

public class UpdateRoleCommandValidator : AbstractValidator<UpdateRoleCommand>
{
    public UpdateRoleCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Informe o cargo.");
        RuleFor(x => x.Name).ValidRoleName();
        RuleFor(x => x.Description).ValidRoleDescription();
        RuleFor(x => x.Permissions).ValidPermissions();
    }
}
