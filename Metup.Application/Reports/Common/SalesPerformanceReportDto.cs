namespace Metup.Application.Reports.Common;

/// <summary>
/// Desempenho de um grupo (responsável, segmento ou origem) no período: negócios por status, taxa
/// de fechamento (ganhos / (ganhos + perdidos)) e ticket médio — média de <c>Deal.Amount</c> nos
/// negócios ganhos. O agrupamento muda por relatório (V3, seção 7 do CLAUDE.md); a forma dos
/// números, não — por isso um único DTO genérico serve as três quebras.
/// </summary>
public record SalesPerformanceGroupDto(
    string GroupKey,
    string GroupLabel,
    int OpenDeals,
    int WonDeals,
    int LostDeals,
    decimal? CloseRate,
    decimal? AverageTicket,
    decimal TotalRevenue);

public record SalesPerformanceReportDto(IReadOnlyList<SalesPerformanceGroupDto> Groups);
