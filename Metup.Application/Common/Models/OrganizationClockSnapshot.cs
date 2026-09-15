namespace Metup.Application.Common.Models;

/// <summary>
/// O "agora" da organização e os recortes de dia no fuso dela. O banco guarda UTC; o que o usuário
/// chama de hoje, de ontem e de "dia 14" é local — converter num só lugar evita o deslocamento de
/// tudo que acontece entre 21h e meia-noite em Brasília.
/// </summary>
public sealed class OrganizationClockSnapshot(TimeZoneInfo timeZone, DateTime utcNow)
{
    public TimeZoneInfo TimeZone { get; } = timeZone;

    public DateTime UtcNow { get; } = utcNow;

    public DateTime LocalNow => TimeZoneInfo.ConvertTimeFromUtc(UtcNow, TimeZone);

    /// <summary>A data de hoje no fuso da organização.</summary>
    public DateOnly Today => DateOnly.FromDateTime(LocalNow);

    public DateOnly LocalDateOf(DateTime utc) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(EnsureUtc(utc), TimeZone));

    /// <summary>Instante UTC em que o dia local começa (00:00 locais).</summary>
    public DateTime StartOfDayUtc(DateOnly localDate) => ToUtc(localDate.ToDateTime(TimeOnly.MinValue));

    /// <summary>Último instante UTC ainda pertencente ao dia local.</summary>
    public DateTime EndOfDayUtc(DateOnly localDate) => StartOfDayUtc(localDate.AddDays(1)).AddTicks(-1);

    private DateTime ToUtc(DateTime localDateTime)
    {
        var local = DateTime.SpecifyKind(localDateTime, DateTimeKind.Unspecified);

        // Horário que não existe por causa do salto do horário de verão: o dia local começa na
        // primeira hora válida seguinte.
        while (TimeZone.IsInvalidTime(local))
        {
            local = local.AddMinutes(30);
        }

        return TimeZoneInfo.ConvertTimeToUtc(local, TimeZone);
    }

    private static DateTime EnsureUtc(DateTime value) =>
        value.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(value, DateTimeKind.Utc) : value.ToUniversalTime();
}
