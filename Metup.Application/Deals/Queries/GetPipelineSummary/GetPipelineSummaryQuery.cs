using FluentValidation;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Validation;
using Metup.Application.Deals.Common;
using MediatR;

namespace Metup.Application.Deals.Queries.GetPipelineSummary;

/// <param name="From">Início do período (data local, inclusive). Sem período = últimos 30 dias.</param>
public record GetPipelineSummaryQuery(
    DealPipelineFilter Filter,
    DateOnly? From = null,
    DateOnly? To = null) : IRequest<PipelineSummaryDto>;

public class GetPipelineSummaryQueryValidator : AbstractValidator<GetPipelineSummaryQuery>
{
    public GetPipelineSummaryQueryValidator(IOrganizationClock organizationClock)
    {
        RuleFor(x => x.Filter).NotNull().SetValidator(new DealPipelineFilterValidator());
        this.AddLocalPeriodRules(x => x.From, x => x.To, organizationClock);
    }
}
