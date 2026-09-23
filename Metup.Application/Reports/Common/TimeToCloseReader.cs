using Metup.Application.Common.Interfaces;
using Metup.Domain.Deals;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Reports.Common;

/// <summary>
/// "Quanto tempo leva para fechar" é definido aqui e em nenhum outro lugar: dias entre
/// <c>Deal.CreatedAt</c> e <c>Deal.ClosedAt</c> dos negócios ganhos <b>no período</b> (por
/// ClosedAt), com média, distribuição e a mesma leitura na janela anterior. Usado pelo relatório de
/// funil e pelo endpoint isolado de tempo até fechamento.
/// </summary>
public class TimeToCloseReader(IApplicationDbContext context)
{
    /// <summary>Cortes da distribuição, em dias. O último balde é "daí para cima".</summary>
    private static readonly int[] Buckets = [7, 15, 30, 60];

    public async Task<TimeToCloseDto> ReadAsync(ReportWindow window, CancellationToken cancellationToken)
    {
        var won = await context.Deals
            .AsNoTracking()
            .Where(d => d.OrganizationId == window.OrganizationId
                && d.Status == DealStatus.Ganho
                && d.ClosedAt != null
                && d.ClosedAt >= window.PreviousStart
                && d.ClosedAt <= window.PeriodEnd)
            .Select(d => new { d.CreatedAt, ClosedAt = d.ClosedAt!.Value })
            .ToListAsync(cancellationToken);

        return From(
            won.Where(d => window.InPeriod(d.ClosedAt)).Select(d => (d.ClosedAt - d.CreatedAt).TotalDays).ToList(),
            won.Where(d => window.InPrevious(d.ClosedAt)).Select(d => (d.ClosedAt - d.CreatedAt).TotalDays).ToList());
    }

    public static TimeToCloseDto From(IReadOnlyCollection<double> current, IReadOnlyCollection<double> previous) =>
        new(
            current.Count,
            current.Count > 0 ? current.Average() : null,
            previous.Count > 0 ? previous.Average() : null,
            Distribution(current));

    private static List<DurationBucketDto> Distribution(IReadOnlyCollection<double> daysToClose)
    {
        var buckets = new List<DurationBucketDto>();
        // O primeiro balde começa aberto para baixo: um negócio fechado no mesmo dia tem 0 dias.
        var lowerBound = double.NegativeInfinity;

        foreach (var upTo in Buckets)
        {
            buckets.Add(new DurationBucketDto(upTo, daysToClose.Count(d => d > lowerBound && d <= upTo)));
            lowerBound = upTo;
        }

        buckets.Add(new DurationBucketDto(null, daysToClose.Count(d => d > Buckets[^1])));
        return buckets;
    }
}
