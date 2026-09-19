namespace Metup.Application.Deals.Analytics;

/// <summary>
/// Números de venda derivados de receita e ganhos de um período. A receita ganha é a soma do valor
/// fechado (<c>Amount</c>) dos negócios ganhos com <c>ClosedAt</c> no período — nunca o ticket.
/// </summary>
public static class SalesMetrics
{
    /// <summary>
    /// Receita ganha ÷ negócios ganhos — a mesma conta que o card "Ticket Médio" do dashboard faz
    /// com <c>Revenue</c> e <c>WonDeals</c>. <c>null</c> sem ganho no período.
    /// </summary>
    public static decimal? AverageTicket(decimal wonRevenue, int wonDeals) =>
        wonDeals > 0 ? wonRevenue / wonDeals : null;
}
