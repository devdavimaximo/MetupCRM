using Metup.Application.Reports.Common;
using MediatR;

namespace Metup.Application.Reports.Queries.GetSalesPerformanceBySegment;

/// <summary>Período opcional sobre Deal.CreatedAt — sem período, considera todo o histórico da organização.</summary>
public record GetSalesPerformanceBySegmentQuery(DateTime? From, DateTime? To) : IRequest<SalesPerformanceReportDto>;
