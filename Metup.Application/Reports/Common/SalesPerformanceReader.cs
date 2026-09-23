using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Domain.Deals;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Reports.Common;

/// <summary>
/// Um negócio, reduzido ao que as três quebras de desempenho precisam. Carrega os três eixos de
/// agrupamento (responsável, segmento, origem) porque a leitura é a mesma — só o <c>GroupBy</c> muda.
/// </summary>
public readonly record struct SalesPerformanceRow(
    Guid OwnerUserId,
    string? Segment,
    DealSource Source,
    DealStatus Status,
    decimal? Amount,
    decimal? Ticket,
    DateTime? ClosedAt)
{
    /// <summary>Valor efetivo do negócio aberto: o valor em negociação ou, na falta dele, o ticket estimado.</summary>
    public decimal EffectiveAmount => Amount ?? Ticket ?? 0m;
}

/// <summary>
/// A leitura de desempenho comercial compartilhada pelas quebras por responsável, segmento e
/// origem (V3, seção 7 do CLAUDE.md): uma ida ao banco, uma regra só, três agrupamentos.
///
/// O recorte é deliberado e está documentado em <see cref="SalesPerformanceGroupDto"/>: o que
/// fechou conta por <c>Deal.ClosedAt</c> dentro da janela (e da anterior, para comparar); o que
/// está aberto é a fotografia de hoje, sem recorte de período.
/// </summary>
public class SalesPerformanceReader(IApplicationDbContext context)
{
    public async Task<IReadOnlyList<SalesPerformanceRow>> ReadAsync(ReportWindow window, CancellationToken cancellationToken) =>
        await (
            from d in context.Deals.AsNoTracking()
            join c in context.Companies.AsNoTracking() on d.CompanyId equals c.Id
            where d.OrganizationId == window.OrganizationId
                && (d.Status == DealStatus.Aberto
                    || (d.ClosedAt >= window.PreviousStart && d.ClosedAt <= window.PeriodEnd))
            select new SalesPerformanceRow(d.OwnerUserId, c.Segment, d.Source, d.Status, d.Amount, d.Ticket, d.ClosedAt))
            .ToListAsync(cancellationToken);

    /// <summary>Agrupa as linhas pelo eixo pedido e monta o relatório, com a linha de total no fim.</summary>
    public static SalesPerformanceReportDto Build(
        ReportWindow window,
        IEnumerable<SalesPerformanceRow> rows,
        Func<SalesPerformanceRow, string> keyOf,
        Func<SalesPerformanceRow, string> labelOf,
        Func<SalesPerformanceGroupDto, object> orderBy)
    {
        var materialized = rows as IReadOnlyCollection<SalesPerformanceRow> ?? rows.ToList();

        var groups = materialized
            .GroupBy(keyOf)
            .Select(g => BuildGroup(window, g.Key, labelOf(g.First()), g.ToList()))
            .OrderBy(orderBy)
            .ToList();

        return new SalesPerformanceReportDto(window.Period, groups, BuildTotals(window, materialized, groups.Count));
    }

    private static SalesPerformanceGroupDto BuildGroup(
        ReportWindow window,
        string key,
        string label,
        IReadOnlyCollection<SalesPerformanceRow> rows)
    {
        var current = Closed(window, rows, window.InPeriod);
        var previous = Closed(window, rows, window.InPrevious);
        var open = rows.Where(r => r.Status == DealStatus.Aberto).ToList();

        return new SalesPerformanceGroupDto(
            key,
            label,
            open.Count,
            open.Sum(r => r.EffectiveAmount),
            current.Won,
            current.Lost,
            CloseRate(current.Won, current.Lost),
            current.AverageTicket,
            current.Revenue,
            previous.Won,
            previous.Revenue,
            CloseRate(previous.Won, previous.Lost));
    }

    private static SalesPerformanceTotalsDto BuildTotals(
        ReportWindow window,
        IReadOnlyCollection<SalesPerformanceRow> rows,
        int groupCount)
    {
        var current = Closed(window, rows, window.InPeriod);
        var previous = Closed(window, rows, window.InPrevious);
        var open = rows.Where(r => r.Status == DealStatus.Aberto).ToList();

        return new SalesPerformanceTotalsDto(
            groupCount,
            open.Count,
            open.Sum(r => r.EffectiveAmount),
            current.Won,
            current.Lost,
            CloseRate(current.Won, current.Lost),
            current.AverageTicket,
            new PeriodValueDto(current.Revenue, previous.Revenue));
    }

    private static (int Won, int Lost, decimal Revenue, decimal? AverageTicket) Closed(
        ReportWindow window,
        IEnumerable<SalesPerformanceRow> rows,
        Func<DateTime?, bool> inWindow)
    {
        var closed = rows.Where(r => r.Status != DealStatus.Aberto && inWindow(r.ClosedAt)).ToList();
        var won = closed.Where(r => r.Status == DealStatus.Ganho).ToList();

        return (
            won.Count,
            closed.Count(r => r.Status == DealStatus.Perdido),
            won.Sum(r => r.Amount ?? 0m),
            won.Count > 0 ? won.Average(r => r.Amount ?? 0m) : null);
    }

    private static decimal? CloseRate(int won, int lost) =>
        won + lost > 0 ? (decimal)won / (won + lost) : null;
}
