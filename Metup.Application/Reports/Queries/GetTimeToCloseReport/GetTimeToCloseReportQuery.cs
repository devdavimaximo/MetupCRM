using Metup.Application.Reports.Common;
using MediatR;

namespace Metup.Application.Reports.Queries.GetTimeToCloseReport;

/// <summary>Período opcional sobre Deal.CreatedAt — sem período, considera todo o histórico da organização.</summary>
public record GetTimeToCloseReportQuery(DateTime? From, DateTime? To) : IRequest<TimeToCloseReportDto>;
