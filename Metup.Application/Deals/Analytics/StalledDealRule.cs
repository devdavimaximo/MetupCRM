namespace Metup.Application.Deals.Analytics;

/// <summary>
/// Quando um negócio aberto conta como parado: sem mudar de etapa há <b>mais de</b>
/// <c>Organization.StalledDealDays</c> dias inteiros. Um lugar só para o funil do dashboard e para a
/// notificação "ficou parado hoje" contarem igual.
/// </summary>
public static class StalledDealRule
{
    public static int DaysInStage(DateTime lastStageChangeUtc, DateTime nowUtc) =>
        (int)(nowUtc - lastStageChangeUtc).TotalDays;

    public static bool IsStalled(DateTime lastStageChangeUtc, DateTime nowUtc, int stalledDealDays) =>
        DaysInStage(lastStageChangeUtc, nowUtc) > stalledDealDays;

    /// <summary>Instante em que o negócio passa a contar como parado.</summary>
    public static DateTime StalledAt(DateTime lastStageChangeUtc, int stalledDealDays) =>
        lastStageChangeUtc.AddDays(stalledDealDays + 1);
}
