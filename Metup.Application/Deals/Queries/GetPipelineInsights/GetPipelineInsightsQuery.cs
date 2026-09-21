using FluentValidation;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Validation;
using Metup.Application.Deals.Common;
using MediatR;

namespace Metup.Application.Deals.Queries.GetPipelineInsights;

/// <summary>
/// Diagnóstico do pipeline. A janela são sempre os últimos <c>PipelineInsightsDto.WindowDays</c>
/// dias <b>terminando na referência</b> do período pedido (o <c>to</c>, ou hoje) — o <c>from</c> só
/// serve para situar essa referência, como manda o item 17.
/// </summary>
public record GetPipelineInsightsQuery(
    DealPipelineFilter Filter,
    DateOnly? From = null,
    DateOnly? To = null) : IRequest<PipelineInsightsDto>;

public class GetPipelineInsightsQueryValidator : AbstractValidator<GetPipelineInsightsQuery>
{
    public GetPipelineInsightsQueryValidator(IOrganizationClock organizationClock)
    {
        RuleFor(x => x.Filter).NotNull().SetValidator(new DealPipelineFilterValidator());
        this.AddLocalPeriodRules(x => x.From, x => x.To, organizationClock);
    }
}
