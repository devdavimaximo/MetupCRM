using Metup.Application.LeadFinder.Common;
using MediatR;

namespace Metup.Application.LeadFinder.Commands.RequestLeadSearch;

/// <param name="Query">O nicho, em linguagem natural ("clínicas odontológicas").</param>
/// <param name="Location">Cidade/região ("Curitiba, PR"). Opcional.</param>
/// <param name="WithoutWebsite">Só empresas sem site.</param>
public record RequestLeadSearchCommand(string Query, string? Location, int? MaxResults, bool WithoutWebsite = false)
    : IRequest<LeadSearchDto>;
