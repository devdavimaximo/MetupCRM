using FluentValidation;
using Metup.Application.Common.Interfaces;
using Metup.Application.Reports.Common;
using MediatR;

namespace Metup.Application.Reports.Queries.GetForecastReport;

/// <summary>
/// Mesma janela dos demais relatórios, mas aplicada só para escopar <b>quando os negócios abertos
/// entraram no funil</b>: o corte que importa aqui é <c>Deal.Status == Aberto</c>, porque o
/// forecast olha para frente, não para o que já fechou.
/// </summary>
public record GetForecastReportQuery(int Days = IReportPeriodRequest.DefaultDays, DateOnly? From = null, DateOnly? To = null)
    : IReportPeriodRequest, IRequest<ForecastReportDto>;

public class GetForecastReportQueryValidator : AbstractValidator<GetForecastReportQuery>
{
    public GetForecastReportQueryValidator(IOrganizationClock organizationClock) =>
        this.AddReportPeriodRules(organizationClock);
}
