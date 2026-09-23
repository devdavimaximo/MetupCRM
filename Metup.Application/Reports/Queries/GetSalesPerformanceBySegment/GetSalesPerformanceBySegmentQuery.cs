using FluentValidation;
using Metup.Application.Common.Interfaces;
using Metup.Application.Reports.Common;
using MediatR;

namespace Metup.Application.Reports.Queries.GetSalesPerformanceBySegment;

/// <summary>
/// Desempenho por segmento de empresa na janela pedida (recorte por <c>Deal.CreatedAt</c>), com a janela anterior
/// de mesma duração como base de comparação.
/// </summary>
public record GetSalesPerformanceBySegmentQuery(int Days = IReportPeriodRequest.DefaultDays, DateOnly? From = null, DateOnly? To = null)
    : IReportPeriodRequest, IRequest<SalesPerformanceReportDto>;

public class GetSalesPerformanceBySegmentQueryValidator : AbstractValidator<GetSalesPerformanceBySegmentQuery>
{
    public GetSalesPerformanceBySegmentQueryValidator(IOrganizationClock organizationClock) =>
        this.AddReportPeriodRules(organizationClock);
}
