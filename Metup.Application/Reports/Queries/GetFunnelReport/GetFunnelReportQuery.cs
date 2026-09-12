using Metup.Application.Reports.Common;
using MediatR;

namespace Metup.Application.Reports.Queries.GetFunnelReport;

/// <summary>Período opcional sobre Deal.CreatedAt — sem período, considera todo o histórico da organização.</summary>
public record GetFunnelReportQuery(DateTime? From, DateTime? To) : IRequest<FunnelReportDto>;
