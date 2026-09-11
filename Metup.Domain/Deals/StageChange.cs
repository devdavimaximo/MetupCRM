using Metup.Domain.Common;

namespace Metup.Domain.Deals;

/// <summary>
/// Histórico de mudança de estágio de um Deal — inegociável (regra 4.2 do CLAUDE.md).
/// Toda transição, inclusive o nascimento do negócio e o fechamento, gera uma linha aqui.
/// </summary>
public class StageChange : BaseEntity
{
    public Guid DealId { get; set; }

    /// <summary>Nulo apenas na primeira linha: o nascimento do negócio não parte de estágio nenhum.</summary>
    public DealStage? FromStage { get; set; }

    public DealStage ToStage { get; set; }

    public DateTime ChangedAt { get; set; }

    public Guid ChangedByUserId { get; set; }
}
