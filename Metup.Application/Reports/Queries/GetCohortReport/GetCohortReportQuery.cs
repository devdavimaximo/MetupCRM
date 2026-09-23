using FluentValidation;
using Metup.Application.Common.Interfaces;
using Metup.Application.Reports.Common;
using MediatR;

namespace Metup.Application.Reports.Queries.GetCohortReport;

/// <summary>
/// Janela sobre <c>Deal.CreatedAt</c> que define <b>quais</b> negócios entram nas safras; o corte
/// entre safras continua sendo o mês de entrada no funil, não o período pedido.
/// </summary>
public record GetCohortReportQuery(int Days = IReportPeriodRequest.DefaultDays, DateOnly? From = null, DateOnly? To = null)
    : IReportPeriodRequest, IRequest<CohortReportDto>;

public class GetCohortReportQueryValidator : AbstractValidator<GetCohortReportQuery>
{
    public GetCohortReportQueryValidator(IOrganizationClock organizationClock) =>
        this.AddReportPeriodRules(organizationClock);
}
