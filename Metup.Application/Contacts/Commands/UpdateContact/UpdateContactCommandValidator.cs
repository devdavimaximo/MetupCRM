using FluentValidation;

namespace Metup.Application.Contacts.Commands.UpdateContact;

public class UpdateContactCommandValidator : AbstractValidator<UpdateContactCommand>
{
    public UpdateContactCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Informe o contato.");

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
