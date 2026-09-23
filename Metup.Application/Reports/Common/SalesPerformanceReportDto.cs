using Metup.Application.Common.Models;

namespace Metup.Application.Reports.Common;

/// <summary>
/// Desempenho de um grupo (responsável, segmento ou origem) na janela pedida.
///
/// Fechamentos e dinheiro contam por <c>Deal.ClosedAt</c> — o que o grupo <b>fechou no período</b>,
/// com a mesma leitura na janela anterior (<see cref="PreviousWonDeals"/>,
/// <see cref="PreviousRevenue"/>), para a comparação ser entre iguais. <see cref="OpenDeals"/> e
/// <see cref="OpenAmount"/> são a fotografia do pipeline aberto do grupo hoje — não dependem do
/// período, porque "o que está em aberto" não tem data de fechamento.
///
/// O agrupamento muda por relatório (V3, seção 7 do CLAUDE.md); a forma dos números, não — por
/// isso um único DTO genérico serve as três quebras.
/// </summary>
public record SalesPerformanceGroupDto(
    string GroupKey,
    string GroupLabel,
    int OpenDeals,
    decimal OpenAmount,
    int WonDeals,
    int LostDeals,
    decimal? CloseRate,
    decimal? AverageTicket,
    decimal TotalRevenue,
    int PreviousWonDeals,
    decimal PreviousRevenue,
    decimal? PreviousCloseRate);

/// <summary>A mesma leitura somando todos os grupos — a linha de total da organização.</summary>
public record SalesPerformanceTotalsDto(
    int Groups,
    int OpenDeals,
    decimal OpenAmount,
    int WonDeals,
    int LostDeals,
    decimal? CloseRate,
    decimal? AverageTicket,
    PeriodValueDto Revenue);

public record SalesPerformanceReportDto(
    ReportPeriodDto Period,
    IReadOnlyList<SalesPerformanceGroupDto> Groups,
    SalesPerformanceTotalsDto Totals);
