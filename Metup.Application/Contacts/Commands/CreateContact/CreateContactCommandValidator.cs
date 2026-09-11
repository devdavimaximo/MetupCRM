using FluentValidation;

namespace Metup.Application.Contacts.Commands.CreateContact;

public class CreateContactCommandValidator : AbstractValidator<CreateContactCommand>
{
    public CreateContactCommandValidator()
    {
        RuleFor(x => x.CompanyId)
            .NotEmpty().WithMessage("Informe a empresa do contato.");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Informe o nome do contato.")
            .MaximumLength(200);

        RuleFor(x => x.Role).MaximumLength(120);
        RuleFor(x => x.Phone).MaximumLength(40);
        RuleFor(x => x.WhatsApp).MaximumLength(40);

        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("E-mail inválido.")
            .MaximumLength(320)
            .When(x => !string.IsNullOrWhiteSpace(x.Email));
    }
}
