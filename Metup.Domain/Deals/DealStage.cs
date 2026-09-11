namespace Metup.Domain.Deals;

/// <summary>
/// Estágios do funil comercial (seção 4.2 do CLAUDE.md) — first-class, nunca texto livre.
/// Ganho e Perdido são estágios terminais: só são alcançados fechando o negócio.
/// </summary>
public enum DealStage
{
    Prospect,
    PrimeiroContato,
    ContatoRealizado,
    Qualificacao,
    Reuniao,
    Proposta,
    Negociacao,
    Ganho,
    Perdido,
}
