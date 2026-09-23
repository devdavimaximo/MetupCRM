using Metup.Application.Reports.Common;
using Metup.Domain.Deals;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Reports.Queries.GetCohortReport;

/// <summary>
/// Safras de negócios por mês de entrada no funil (V3, seção 7 do CLAUDE.md): diferente das
/// quebras por responsável/segmento/origem, que cortam um período por um eixo fixo, aqui o corte é
/// o próprio tempo — cada safra é o conjunto de negócios criados no mesmo mês (Deal.CreatedAt), e o
/// relatório acompanha como cada uma converteu e quão rápido. A janela pedida escopa quais negócios
/// entram nas safras.
///
/// O agrupamento é feito em memória porque o corte por mês de Deal.CreatedAt precisa acontecer no
/// fuso da organização — e isso não tem tradução estável para SQL via EF Core.
/// </summary>
public class GetCohortReportQueryHandler(
    ReportPeriodResolver periodResolver) : IRequestHandler<GetCohortReportQuery, CohortReportDto>
{
    public async Task<CohortReportDto> Handle(GetCohortReportQuery request, CancellationToken cancellationToken)
    {
        var window = await periodResolver.ResolveAsync(request, cancellationToken);

        var deals = await periodResolver.DealsCreatedInWindow(window)
            .Select(d => new { d.CreatedAt, d.Status, d.Amount, d.ClosedAt })
            .ToListAsync(cancellationToken);

        var cohorts = deals
            .Where(d => window.InPeriod(d.CreatedAt))
            .GroupBy(d =>
            {
                var localDate = window.Clock.LocalDateOf(d.CreatedAt);
                return new DateOnly(localDate.Year, localDate.Month, 1);
            })
            .Select(g =>
            {
                var won = g.Where(d => d.Status == DealStatus.Ganho).ToList();
                var lostCount = g.Count(d => d.Status == DealStatus.Perdido);
                var openCount = g.Count(d => d.Status == DealStatus.Aberto);

                var daysToClose = won
                    .Where(d => d.ClosedAt.HasValue)
                    .Select(d => (d.ClosedAt!.Value - d.CreatedAt).TotalDays)
                    .ToList();

                return new CohortGroupDto(
                    g.Key.ToString("yyyy-MM"),
                    g.Count(),
                    openCount,
                    won.Count,
                    lostCount,
                    won.Count + lostCount > 0 ? (decimal)won.Count / (won.Count + lostCount) : null,
                    won.Count > 0 ? won.Average(d => d.Amount ?? 0m) : null,
                    won.Sum(d => d.Amount ?? 0m),
                    daysToClose.Count > 0 ? daysToClose.Average() : null);
            })
            .OrderBy(c => c.CohortKey)
            .ToList();

        return new CohortReportDto(window.Period, cohorts);
    }
}
