using FluentValidation;

namespace Metup.Application.Companies.Commands.CreateCompany;

public class CreateCompanyCommandValidator : AbstractValidator<CreateCompanyCommand>
{
    public CreateCompanyCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Informe o nome da empresa.")
            .MaximumLength(200);

        RuleFor(x => x.Segment).MaximumLength(120);
        RuleFor(x => x.City).MaximumLength(120);
        RuleFor(x => x.Instagram).MaximumLength(120);
        RuleFor(x => x.Phone).MaximumLength(40);
    }
}
