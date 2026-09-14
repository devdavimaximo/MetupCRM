using Metup.Application.Reports.Common;
using MediatR;

namespace Metup.Application.Reports.Queries.GetSalesPerformanceBySource;

/// <summary>Período opcional sobre Deal.CreatedAt — sem período, considera todo o histórico da organização.</summary>
public record GetSalesPerformanceBySourceQuery(DateTime? From, DateTime? To) : IRequest<SalesPerformanceReportDto>;
