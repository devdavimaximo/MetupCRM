using FluentValidation;

namespace Metup.Application.Auth.Commands.RegisterOrganization;

public class RegisterOrganizationCommandValidator : AbstractValidator<RegisterOrganizationCommand>
{
    public RegisterOrganizationCommandValidator()
    {
        RuleFor(x => x.OrganizationName)
            .NotEmpty().WithMessage("Informe o nome da organização.")
            .MaximumLength(200);

        RuleFor(x => x.AdminName)
            .NotEmpty().WithMessage("Informe o nome do administrador.")
            .MaximumLength(200);

        RuleFor(x => x.AdminEmail)
            .NotEmpty().WithMessage("Informe o e-mail do administrador.")
            .EmailAddress().WithMessage("E-mail inválido.")
            .MaximumLength(320);

        RuleFor(x => x.AdminPassword)
            .NotEmpty().WithMessage("Informe a senha.")
            .MinimumLength(8).WithMessage("A senha deve ter no mínimo 8 caracteres.");
    }
}
