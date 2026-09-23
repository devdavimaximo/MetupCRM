using FluentValidation;
using Metup.Application.Common.Interfaces;
using Metup.Application.Reports.Common;
using MediatR;

namespace Metup.Application.Reports.Queries.GetFunnelReport;

/// <summary>
/// Janela de <paramref name="Days"/> dias inteiros terminando hoje (no fuso da organização), ou o
/// intervalo local <paramref name="From"/>–<paramref name="To"/> (inclusive), que tem precedência.
/// O recorte é por <c>Deal.CreatedAt</c> — a coorte de negócios que entrou no funil no período — e
/// a comparação é sempre a janela anterior de mesma duração.
/// </summary>
public record GetFunnelReportQuery(int Days = IReportPeriodRequest.DefaultDays, DateOnly? From = null, DateOnly? To = null)
    : IReportPeriodRequest, IRequest<FunnelReportDto>;

public class GetFunnelReportQueryValidator : AbstractValidator<GetFunnelReportQuery>
{
    public GetFunnelReportQueryValidator(IOrganizationClock organizationClock) =>
        this.AddReportPeriodRules(organizationClock);
}
