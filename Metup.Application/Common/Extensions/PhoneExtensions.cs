namespace Metup.Application.Common.Extensions;

public static class PhoneExtensions
{
    private const int SignificantDigits = 10;

    public static string DigitsOnly(this string value) =>
        new([.. value.Where(char.IsDigit)]);

    /// <summary>
    /// Compara dois números de telefone/WhatsApp tolerando formatação e DDI diferentes —
    /// compara só os últimos <see cref="SignificantDigits"/> dígitos (suficiente para
    /// identificar um número dentro de uma organização; V1 não lida com portabilidade
    /// internacional de área/DDI).
    /// </summary>
    public static bool MatchesPhone(this string? a, string? b)
    {
        if (string.IsNullOrWhiteSpace(a) || string.IsNullOrWhiteSpace(b))
        {
            return false;
        }

        var digitsA = a.DigitsOnly();
        var digitsB = b.DigitsOnly();

        if (digitsA.Length < SignificantDigits || digitsB.Length < SignificantDigits)
        {
            return digitsA == digitsB;
        }

        return digitsA[^SignificantDigits..] == digitsB[^SignificantDigits..];
    }
}
