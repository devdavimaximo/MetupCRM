using FluentValidation;
using Metup.Application.Search.Common;
using MediatR;

namespace Metup.Application.Search.Queries.GlobalSearch;

/// <summary>Busca global da paleta de comandos: empresas, contatos e negócios.</summary>
public record SearchQuery(string Term) : IRequest<SearchResultDto>
{
    public const int MinTermLength = 2;
    public const int MaxTermLength = 100;
    public const int MaxHitsPerGroup = 5;
}

public class SearchQueryValidator : AbstractValidator<SearchQuery>
{
    public SearchQueryValidator()
    {
        RuleFor(x => (x.Term ?? string.Empty).Trim())
            .MinimumLength(SearchQuery.MinTermLength)
            .WithMessage($"Digite pelo menos {SearchQuery.MinTermLength} caracteres.")
            .MaximumLength(SearchQuery.MaxTermLength)
            .WithMessage($"A busca pode ter no máximo {SearchQuery.MaxTermLength} caracteres.")
            .OverridePropertyName(nameof(SearchQuery.Term));
    }
}
