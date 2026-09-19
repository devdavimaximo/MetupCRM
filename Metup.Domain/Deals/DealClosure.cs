namespace Metup.Domain.Deals;

/// <summary>
/// O que o fechamento grava além do próprio negócio: a transição para Ganho/Perdido e, se o valor
/// final mudou, o registro de histórico de valor. Quem chama adiciona os dois ao contexto — mesmo
/// contrato de <see cref="Deal.ChangeStage"/>.
/// </summary>
public sealed record DealClosure(StageChange StageChange, DealValueChange? ValueChange);
