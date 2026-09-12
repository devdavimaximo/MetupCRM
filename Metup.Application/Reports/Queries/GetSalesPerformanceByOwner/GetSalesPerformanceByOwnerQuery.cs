using Metup.Application.Reports.Common;
using MediatR;

namespace Metup.Application.Reports.Queries.GetSalesPerformanceByOwner;

/// <summary>Período opcional sobre Deal.CreatedAt — sem período, considera todo o histórico da organização.</summary>
public record GetSalesPerformanceByOwnerQuery(DateTime? From, DateTime? To) : IRequest<SalesPerformanceReportDto>;
