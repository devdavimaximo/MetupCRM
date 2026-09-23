using FluentValidation;
using Metup.Application.Common.Interfaces;
using Metup.Application.Reports.Common;
using MediatR;

namespace Metup.Application.Reports.Queries.GetTimeToCloseReport;

/// <summary>
/// Tempo até fechamento isolado do funil — mesma janela dos demais relatórios, recortada por
/// <c>Deal.ClosedAt</c> (o que fechou no período), com a janela anterior como comparação.
/// </summary>
public record GetTimeToCloseReportQuery(int Days = IReportPeriodRequest.DefaultDays, DateOnly? From = null, DateOnly? To = null)
    : IReportPeriodRequest, IRequest<TimeToCloseReportDto>;

public class GetTimeToCloseReportQueryValidator : AbstractValidator<GetTimeToCloseReportQuery>
{
    public GetTimeToCloseReportQueryValidator(IOrganizationClock organizationClock) =>
        this.AddReportPeriodRules(organizationClock);
}
