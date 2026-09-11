using FluentValidation;

namespace Metup.Application.Companies.Queries.ListCompanies;

public class ListCompaniesQueryValidator : AbstractValidator<ListCompaniesQuery>
{
    public const int MaxPageSize = 100;

    public ListCompaniesQueryValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThan(0).WithMessage("A página deve ser maior que zero.");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, MaxPageSize)
            .WithMessage($"O tamanho da página deve estar entre 1 e {MaxPageSize}.");

        RuleFor(x => x.Search).MaximumLength(200);
        RuleFor(x => x.Segment).MaximumLength(120);
        RuleFor(x => x.City).MaximumLength(120);
    }
}
