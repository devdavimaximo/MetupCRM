using FluentValidation;
using Metup.Application.Common.Interfaces;
using Metup.Application.Reports.Common;
using MediatR;

namespace Metup.Application.Reports.Queries.GetSalesPerformanceByOwner;

/// <summary>
/// Desempenho por responsável na janela pedida (recorte por <c>Deal.CreatedAt</c>), com a janela anterior
/// de mesma duração como base de comparação.
/// </summary>
public record GetSalesPerformanceByOwnerQuery(int Days = IReportPeriodRequest.DefaultDays, DateOnly? From = null, DateOnly? To = null)
    : IReportPeriodRequest, IRequest<SalesPerformanceReportDto>;

public class GetSalesPerformanceByOwnerQueryValidator : AbstractValidator<GetSalesPerformanceByOwnerQuery>
{
    public GetSalesPerformanceByOwnerQueryValidator(IOrganizationClock organizationClock) =>
        this.AddReportPeriodRules(organizationClock);
}
