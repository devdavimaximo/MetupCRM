using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Application.Deals.Analytics;
using Metup.Application.Reports.Common;
using Metup.Domain.Deals;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Reports.Queries.GetForecastReport;

/// <summary>
/// Forecast / receita potencial (V3, seção 7 do CLAUDE.md): diferente dos demais relatórios, que
/// olham para o que já fechou, este olha para o pipeline aberto e projeta receita ponderando cada
/// estágio pela probabilidade histórica de fechar como ganho.
///
/// A probabilidade vem do histórico real de StageChange — nunca de uma tabela fixa inventada:
/// para cada estágio, a fração dos negócios que passaram por ele e já fecharam que fechou como
/// Ganho. Sem negócios fechados que passaram pelo estágio, a probabilidade fica <c>null</c> e esse
/// estágio não contribui para o ponderado — melhor não ponderar do que inventar.
///
/// O pipeline é a fotografia de <b>hoje</b> e não é recortado pela janela pedida: um negócio
/// aberto há dois anos continua em aberto, e escondê-lo mentiria sobre o que está em jogo.
/// </summary>
public class GetForecastReportQueryHandler(
    IApplicationDbContext context,
    ReportPeriodResolver periodResolver,
    IStageAnalyticsProvider stageAnalytics) : IRequestHandler<GetForecastReportQuery, ForecastReportDto>
{
    public async Task<ForecastReportDto> Handle(GetForecastReportQuery request, CancellationToken cancellationToken)
    {
        var window = await periodResolver.ResolveAsync(request, cancellationToken);

        var openDeals = await context.Deals
            .AsNoTracking()
            .Where(d => d.OrganizationId == window.OrganizationId && d.Status == DealStatus.Aberto)
            .Select(d => new { d.Stage, d.Amount, d.Ticket, d.ExpectedCloseDate })
            .ToListAsync(cancellationToken);

        var analytics = await stageAnalytics.GetAsync(
            new DealScopeFilter(window.OrganizationId, null, DealScope.Organization),
            cancellationToken);

        decimal? ProbabilityOf(DealStage stage) => analytics.WinProbabilityByStage.GetValueOrDefault(stage);

        var byStage = openDeals
            .GroupBy(d => d.Stage)
            .Select(g =>
            {
                var amount = g.Sum(d => d.Amount ?? d.Ticket ?? 0m);
                var probability = ProbabilityOf(g.Key);
                return new ForecastByStageDto(g.Key, g.Count(), amount, probability, probability * amount);
            })
            .OrderBy(s => s.Stage)
            .ToList();

        // Cada negócio entra no mês da previsão que o responsável informou, ponderado pela
        // probabilidade do estágio em que está. Sem previsão preenchida, cai no balde null — que a
        // UI mostra como convite a preencher, não como R$ 0.
        var byMonth = openDeals
            .GroupBy(d => d.ExpectedCloseDate.HasValue
                ? new DateOnly(d.ExpectedCloseDate.Value.Year, d.ExpectedCloseDate.Value.Month, 1)
                : (DateOnly?)null)
            .Select(g =>
            {
                // Nenhum negócio do mês com probabilidade conhecida → sem ponderado, não R$ 0.
                var weights = g.Select(d => ProbabilityOf(d.Stage) * (d.Amount ?? d.Ticket ?? 0m)).ToList();
                var weighted = weights.Any(w => w.HasValue) ? weights.Sum(w => w ?? 0m) : (decimal?)null;

                return new ForecastMonthDto(
                    g.Key?.ToString("yyyy-MM"),
                    g.Key.HasValue && g.Key.Value < new DateOnly(window.Clock.Today.Year, window.Clock.Today.Month, 1),
                    g.Count(),
                    g.Sum(d => d.Amount ?? d.Ticket ?? 0m),
                    weighted);
            })
            // Sem previsão vai para o fim da lista: é resíduo a tratar, não o próximo mês.
            .OrderBy(m => m.MonthKey is null)
            .ThenBy(m => m.MonthKey)
            .ToList();

        return new ForecastReportDto(
            window.Period,
            byStage,
            byMonth,
            byStage.Sum(s => s.OpenDealsCount),
            byStage.Sum(s => s.OpenAmount),
            byStage.Sum(s => s.WeightedAmount ?? 0m),
            openDeals.Count(d => d.ExpectedCloseDate is null));
    }
}
