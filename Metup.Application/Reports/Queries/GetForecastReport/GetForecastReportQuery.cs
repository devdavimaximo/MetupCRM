using Metup.Application.Reports.Common;
using MediatR;

namespace Metup.Application.Reports.Queries.GetForecastReport;

/// <summary>
/// Período opcional sobre Deal.CreatedAt, aplicado apenas para escopar quais negócios abertos
/// entram no pipeline (quando entraram no funil) — mantém o mesmo filtro compartilhado da tela de
/// relatórios. O corte que importa aqui não é o período, é Deal.Status == Aberto: sem período,
/// considera todo o pipeline aberto da organização.
/// </summary>
public record GetForecastReportQuery(DateTime? From, DateTime? To) : IRequest<ForecastReportDto>;
