namespace Metup.Application.Common.Extensions;

public static class StringExtensions
{
    /// <summary>Campo opcional: espaços em branco viram <c>null</c>, o resto vem sem sobras.</summary>
    public static string? NormalizeOptional(this string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>Campo obrigatório: sempre chega ao banco sem espaços nas pontas.</summary>
    public static string NormalizeRequired(this string value) => value.Trim();
}
