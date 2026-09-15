namespace Metup.Domain.Deals;

/// <summary>
/// Origem do negócio — multi-origem pronto desde já (regra 4.4 do CLAUDE.md). Persistido como texto
/// e recebido do n8n pelo nome: valores existentes <b>nunca</b> são renomeados (o n8n envia "MetaAds").
/// Valores novos entram no fim.
/// </summary>
public enum DealSource
{
    Sdr,
    WhatsApp,
    MetaAds,
    Indicacao,
    Site,
    LinkedIn,
    Outbound,
    Evento,
    Outro,
}
