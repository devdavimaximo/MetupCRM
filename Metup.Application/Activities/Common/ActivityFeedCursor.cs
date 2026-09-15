using System.Globalization;
using System.Text;

namespace Metup.Application.Activities.Common;

/// <summary>
/// Posição no feed: o instante e o id do último item entregue. Opaco para o client (base64 de
/// <c>ticks|id</c>) — só o servidor sabe ler.
/// </summary>
public readonly record struct ActivityFeedCursor(DateTime OccurredAt, Guid Id)
{
    public string Encode() =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes(
            $"{OccurredAt.Ticks.ToString(CultureInfo.InvariantCulture)}|{Id:D}"));

    public static bool TryDecode(string? value, out ActivityFeedCursor cursor)
    {
        cursor = default;
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        try
        {
            var parts = Encoding.UTF8.GetString(Convert.FromBase64String(value)).Split('|');
            if (parts.Length != 2
                || !long.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var ticks)
                || ticks < DateTime.MinValue.Ticks || ticks > DateTime.MaxValue.Ticks
                || !Guid.TryParse(parts[1], out var id))
            {
                return false;
            }

            cursor = new ActivityFeedCursor(new DateTime(ticks, DateTimeKind.Utc), id);
            return true;
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
