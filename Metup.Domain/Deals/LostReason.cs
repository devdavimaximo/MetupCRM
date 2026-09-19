namespace Metup.Domain.Deals;

/// <summary>
/// Por que o negócio foi perdido — enum, nunca texto livre (seção 7 do CLAUDE.md): é o dado da
/// métrica "por que perdemos" (V3). Persistido como texto; valores existentes nunca são renomeados
/// e valores novos entram no fim. Quando os motivos virarem cadastro por organização, cada valor
/// migra para uma linha sem perder o histórico.
/// </summary>
public enum LostReason
{
    Preco,
    SemInteresse,
    Concorrente,
    SemResposta,
    Timing,
    Outro,
}
