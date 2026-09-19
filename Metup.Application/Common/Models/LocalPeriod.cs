namespace Metup.Application.Common.Models;

/// <summary>
/// Recorte do período em datas locais da organização: o intervalo pedido (From/To, inclusive) ou os
/// últimos <c>defaultDays</c> dias terminando hoje. A janela anterior tem a mesma quantidade de dias
/// e termina no dia imediatamente antes do início. Usado pelo dashboard e pelo pipeline.
/// </summary>
public sealed record LocalPeriod(DateOnly StartLocal, DateOnly EndLocal)
{
    public const int MaxDays = 366;

    public int Days => EndLocal.DayNumber - StartLocal.DayNumber + 1;

    public DateOnly PreviousStartLocal => StartLocal.AddDays(-Days);

    public static LocalPeriod Resolve(DateOnly? from, DateOnly? to, DateOnly today, int defaultDays) =>
        from is { } start && to is { } end
            ? new LocalPeriod(start, end)
            : new LocalPeriod(today.AddDays(-(defaultDays - 1)), today);
}
