namespace Metup.Application.Deals.Common;

/// <summary>
/// Valor efetivo de um negócio <b>aberto</b>: o valor em negociação ou, na falta dele, o ticket
/// estimado. Fonte única da regra (item 1 do plano do dashboard) para o overview e as tarefas.
/// Receita ganha nunca usa o ticket.
/// </summary>
public static class DealValue
{
    public static decimal? EffectiveAmount(decimal? amount, decimal? ticket) => amount ?? ticket;

    /// <summary>O valor efetivo veio do ticket, não do valor em negociação.</summary>
    public static bool IsEstimated(decimal? amount, decimal? ticket) => amount is null && ticket is not null;
}
