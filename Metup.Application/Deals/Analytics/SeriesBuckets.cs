namespace Metup.Application.Deals.Analytics;

/// <summary>
/// Tamanho do intervalo das séries por período: até 31 dias, um ponto por dia; acima disso, por
/// semana — a série fica legível em qualquer período. Mesma régua para o gráfico de receita do
/// dashboard e as sparklines do pipeline.
/// </summary>
public static class SeriesBuckets
{
    public const string Day = "day";
    public const string Week = "week";

    public static int DaysPerBucket(int periodDays) => periodDays <= 31 ? 1 : 7;

    public static string Granularity(int periodDays) => DaysPerBucket(periodDays) == 1 ? Day : Week;

    /// <summary>Primeiro e último dia local (inclusive) de cada intervalo; o último é cortado no fim do período.</summary>
    public static IReadOnlyList<(DateOnly Start, DateOnly End)> Of(DateOnly startLocal, DateOnly endLocal)
    {
        var step = DaysPerBucket(endLocal.DayNumber - startLocal.DayNumber + 1);
        var buckets = new List<(DateOnly, DateOnly)>();

        for (var start = startLocal; start <= endLocal; start = start.AddDays(step))
        {
            var end = start.AddDays(step - 1);
            buckets.Add((start, end > endLocal ? endLocal : end));
        }

        return buckets;
    }
}
