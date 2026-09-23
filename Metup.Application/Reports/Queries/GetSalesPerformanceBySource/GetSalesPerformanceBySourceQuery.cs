using FluentValidation;
using Metup.Application.Common.Interfaces;
using Metup.Application.Reports.Common;
using MediatR;

namespace Metup.Application.Reports.Queries.GetSalesPerformanceBySource;

/// <summary>
/// Desempenho por origem do negócio na janela pedida (recorte por <c>Deal.CreatedAt</c>), com a janela anterior
/// de mesma duração como base de comparação.
/// </summary>
public record GetSalesPerformanceBySourceQuery(int Days = IReportPeriodRequest.DefaultDays, DateOnly? From = null, DateOnly? To = null)
    : IReportPeriodRequest, IRequest<SalesPerformanceReportDto>;

public class GetSalesPerformanceBySourceQueryValidator : AbstractValidator<GetSalesPerformanceBySourceQuery>
{
    public GetSalesPerformanceBySourceQueryValidator(IOrganizationClock organizationClock) =>
        this.AddReportPeriodRules(organizationClock);
}
