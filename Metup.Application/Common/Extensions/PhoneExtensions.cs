namespace Metup.Application.Common.Extensions;

public static class PhoneExtensions
{
    private const int SignificantDigits = 10;

    public static string DigitsOnly(this string value) =>
        new([.. value.Where(char.IsDigit)]);

    /// <summary>
    /// Número geográfico brasileiro em E.164 (<c>+55</c> + DDD + número). Aceita com ou sem DDI e com
    /// o zero de tronco ("011…"). Nulo sem DDD ou com tamanho fora do padrão — não dá para discar com
    /// segurança de qualquer lugar.
    /// </summary>
    public static string? ToBrazilianE164(this string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var national = value.DigitsOnly().TrimStart('0');
        return national.Length switch
        {
            10 or 11 => $"+55{national}",
            12 or 13 when national.StartsWith("55", StringComparison.Ordinal) => $"+{national}",
            _ => null,
        };
    }

    /// <summary>
    /// O que vai depois de <c>tel:</c> (e, no futuro, no destino de um softphone): E.164 para números
    /// geográficos; números de serviço nacionais (0800, 0300, 4004-xxxx…) seguem como estão, porque
    /// não têm forma internacional. Nulo quando não é discável.
    /// </summary>
    public static string? ToDialString(this string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var digits = value.DigitsOnly();
        return IsNationalServiceNumber(digits) ? digits : value.ToBrazilianE164();
    }

    /// <summary>0800/0300/0500/0900 + 7 dígitos, ou os "números únicos" 300x/400x de 8 dígitos.</summary>
    private static bool IsNationalServiceNumber(string digits) =>
        (digits.Length == 11 && digits[0] == '0' && digits[1] is '3' or '5' or '8' or '9' && digits[2..4] == "00")
        || (digits.Length == 8 && (digits.StartsWith("300", StringComparison.Ordinal) || digits.StartsWith("400", StringComparison.Ordinal)));

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
