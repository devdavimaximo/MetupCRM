using FluentValidation;

namespace Metup.Application.Deals.Queries.ListDeals;

public class ListDealsQueryValidator : AbstractValidator<ListDealsQuery>
{
    public const int MaxPageSize = 200;

    public ListDealsQueryValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThan(0).WithMessage("A página deve ser maior que zero.");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, MaxPageSize)
            .WithMessage($"O tamanho da página deve estar entre 1 e {MaxPageSize}.");

        RuleFor(x => x.Stage).IsInEnum().WithMessage("Estágio inválido.").When(x => x.Stage.HasValue);
        RuleFor(x => x.Source).IsInEnum().WithMessage("Origem inválida.").When(x => x.Source.HasValue);
    }
}
