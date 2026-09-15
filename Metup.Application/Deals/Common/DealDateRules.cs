namespace Metup.Application.Deals.Common;

/// <summary>
/// Faixa aceita para a previsão de fechamento. A regra de negócio ("não antes da criação") é do
/// domínio; aqui só se barra o dado sem sentido (ano 0001, ano 9999) antes de chegar lá.
/// </summary>
public static class DealDateRules
{
    public static readonly DateOnly MinExpectedCloseDate = new(2000, 1, 1);
    public static readonly DateOnly MaxExpectedCloseDate = new(2100, 12, 31);

    public static bool IsPlausible(DateOnly? date) =>
        date is not { } value || (value >= MinExpectedCloseDate && value <= MaxExpectedCloseDate);
}
