using FluentValidation;

namespace Metup.Application.Companies.Commands.UpdateCompany;

public class UpdateCompanyCommandValidator : AbstractValidator<UpdateCompanyCommand>
{
    public UpdateCompanyCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Informe a empresa.");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Informe o nome da empresa.")
            .MaximumLength(200);

        RuleFor(x => x.Segment).MaximumLength(120);
        RuleFor(x => x.City).MaximumLength(120);
        RuleFor(x => x.Instagram).MaximumLength(120);
        RuleFor(x => x.Phone).MaximumLength(40);
    }
}
