using Metup.Application.Reports.Common;
using MediatR;

namespace Metup.Application.Reports.Queries.GetCohortReport;

/// <summary>Período opcional sobre Deal.CreatedAt — sem período, considera todo o histórico da organização.</summary>
public record GetCohortReportQuery(DateTime? From, DateTime? To) : IRequest<CohortReportDto>;
