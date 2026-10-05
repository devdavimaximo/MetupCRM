using FluentValidation;
using Metup.Domain.LeadFinder;

namespace Metup.Application.LeadFinder.Commands.RequestLeadSearch;

public class RequestLeadSearchCommandValidator : AbstractValidator<RequestLeadSearchCommand>
{
    public RequestLeadSearchCommandValidator()
    {
        RuleFor(x => x.Query)
            .NotEmpty().WithMessage("Diga o que você procura (ex.: clínicas odontológicas).")
            .MinimumLength(3).WithMessage("Descreva o nicho com pelo menos 3 letras.")
            .MaximumLength(LeadSearch.QueryMaxLength);

        RuleFor(x => x.Location).MaximumLength(LeadSearch.LocationMaxLength);

        RuleFor(x => x.MaxResults)
            .InclusiveBetween(LeadSearch.MinResults, LeadSearch.MaxResultsLimit)
            .WithMessage($"Peça entre {LeadSearch.MinResults} e {LeadSearch.MaxResultsLimit} resultados.")
            .When(x => x.MaxResults.HasValue);
    }
}
