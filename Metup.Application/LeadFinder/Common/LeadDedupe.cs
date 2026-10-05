using System.Globalization;
using System.Text;
using Metup.Application.Common.Extensions;

namespace Metup.Application.LeadFinder.Common;

/// <summary>
/// Identidade de um lead garimpado, calculada pelo CRM — nunca aceita pronta do n8n (o CRM é a
/// fronteira de integridade, seção 5 do CLAUDE.md).
///
/// O telefone vem primeiro: duas linhas com o mesmo número são a mesma ligação para o SDR, mesmo que
/// a fonte as trate como lugares diferentes (filiais com central única). Sem telefone, vale o id do
/// lugar na fonte; sem os dois, nome + cidade normalizados.
/// </summary>
public static class LeadDedupe
{
    /// <summary>Mesmo critério de <see cref="PhoneExtensions.MatchesPhone"/>: os últimos 10 dígitos.</summary>
    public const int SignificantPhoneDigits = 10;

    private const int MinPhoneDigits = 8;

    /// <summary>Dígitos do telefone, ou nulo quando não há número utilizável.</summary>
    public static string? PhoneDigits(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
        {
            return null;
        }

        var digits = phone.DigitsOnly();
        return digits.Length < MinPhoneDigits ? null : digits[^Math.Min(digits.Length, 20)..];
    }

    /// <summary>A parte do número que identifica a linha, sem DDI nem zero de operadora.</summary>
    public static string? SignificantPhone(string? phoneDigits) =>
        phoneDigits is null
            ? null
            : phoneDigits.Length <= SignificantPhoneDigits ? phoneDigits : phoneDigits[^SignificantPhoneDigits..];

    public static string Key(string? phoneDigits, string? externalId, string name, string? city)
    {
        if (SignificantPhone(phoneDigits) is { } phone)
        {
            return $"tel:{phone}";
        }

        if (!string.IsNullOrWhiteSpace(externalId))
        {
            // Id da fonte diferencia maiúsculas (place_id do Google): fica como veio.
            return $"ext:{externalId.Trim()}";
        }

        return $"nome:{Normalize(name)}|{Normalize(city)}";
    }

    private static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var decomposed = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        var lastWasSpace = false;
        foreach (var c in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (char.IsLetterOrDigit(c))
            {
                builder.Append(c);
                lastWasSpace = false;
            }
            else if (!lastWasSpace && builder.Length > 0)
            {
                builder.Append(' ');
                lastWasSpace = true;
            }
        }

        return builder.ToString().TrimEnd();
    }
}
