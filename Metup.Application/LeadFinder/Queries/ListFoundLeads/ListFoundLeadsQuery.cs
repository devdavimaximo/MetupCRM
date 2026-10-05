using FluentValidation;
using Metup.Application.LeadFinder.Common;
using Metup.Domain.LeadFinder;
using MediatR;

namespace Metup.Application.LeadFinder.Queries.ListFoundLeads;

public enum FoundLeadSort
{
    /// <summary>Melhor avaliados primeiro (nota, depois volume de avaliações) — os mais estabelecidos.</summary>
    Rating,

    /// <summary>Mais avaliações primeiro — proxy de movimento do negócio.</summary>
    Reviews,

    Name,

    /// <summary>Chegaram por último primeiro.</summary>
    Recent,
}

/// <param name="LeadSearchId">Nulo = todos os leads da organização.</param>
/// <param name="HasWebsite">Falso = só quem não tem site (oportunidade clara para quem vende presença digital).</param>
public record ListFoundLeadsQuery(
    Guid? LeadSearchId,
    FoundLeadStatus Status,
    string? Search,
    bool? HasPhone,
    bool? HasWebsite,
    decimal? MinRating,
    FoundLeadSort Sort,
    int Page,
    int PageSize) : IRequest<FoundLeadPageDto>;

public class ListFoundLeadsQueryValidator : AbstractValidator<ListFoundLeadsQuery>
{
    public ListFoundLeadsQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 200);
        RuleFor(x => x.Search).MaximumLength(200);
        RuleFor(x => x.MinRating).InclusiveBetween(0, 5).When(x => x.MinRating.HasValue);
        RuleFor(x => x.Status).IsInEnum();
        RuleFor(x => x.Sort).IsInEnum();
    }
}
