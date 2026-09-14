namespace Metup.Application.Reports.Common;

/// <summary>
/// Desempenho de uma safra (cohort) de negócios — negócios agrupados pelo mês de entrada no funil
/// (<c>Deal.CreatedAt</c>), não por responsável/segmento/origem como em
/// <see cref="SalesPerformanceGroupDto"/>. <see cref="CohortKey"/> sai como "yyyy-MM" (ordenável e
/// sem tradução); a UI formata o rótulo de exibição. Além da conversão e ticket médio, carrega o
/// tempo médio até fechar dentro da própria safra (cruza com a lógica de
/// <see cref="TimeToCloseReportDto"/>), para comparar não só quanto cada safra converteu mas quão
/// rápido — o que dá sentido ao corte temporal e comparativo entre safras (V3, seção 7 do
/// CLAUDE.md).
/// </summary>
public record CohortGroupDto(
    string CohortKey,
    int TotalDeals,
    int OpenDeals,
    int WonDeals,
    int LostDeals,
    decimal? CloseRate,
    decimal? AverageTicket,
    decimal TotalRevenue,
    double? AverageDaysToClose);

public record CohortReportDto(IReadOnlyList<CohortGroupDto> Cohorts);
