using Metup.Application.Dashboard.Common;
using MediatR;

namespace Metup.Application.Dashboard.Queries.GetDashboardSummary;

/// <summary>Sem parâmetros de propósito — a tela-mãe é sempre "hoje, para o usuário logado".</summary>
public record GetDashboardSummaryQuery : IRequest<DashboardSummaryDto>;
