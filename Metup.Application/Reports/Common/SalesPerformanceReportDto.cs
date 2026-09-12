namespace Metup.Application.Reports.Common;

/// <summary>
/// Desempenho de um responsável (SDR/closer) no período: negócios por status, taxa de fechamento
/// (ganhos / (ganhos + perdidos)) e ticket médio — média de <c>Deal.Amount</c> nos negócios ganhos.
/// </summary>
public record SalesPerformanceByOwnerDto(
    Guid OwnerUserId,
    string OwnerName,
    int OpenDeals,
    int WonDeals,
    int LostDeals,
    decimal? CloseRate,
    decimal? AverageTicket,
    decimal TotalRevenue);

public record SalesPerformanceReportDto(IReadOnlyList<SalesPerformanceByOwnerDto> ByOwner);
