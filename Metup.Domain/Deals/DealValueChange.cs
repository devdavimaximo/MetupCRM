using Metup.Domain.Common;

namespace Metup.Domain.Deals;

/// <summary>
/// Histórico de valor de um negócio (regra 4.6: o histórico comercial nunca se perde). Sem ele,
/// <see cref="Deal.Amount"/> e <see cref="Deal.Ticket"/> sobrescritos apagariam o valor que estava
/// valendo — e "quanto era o pipeline no fim de março" deixaria de ser reconstruível. Guarda os dois
/// campos juntos, de→para, porque o valor efetivo depende dos dois.
/// </summary>
public class DealValueChange : BaseEntity
{
    public Guid DealId { get; init; }

    public decimal? FromAmount { get; init; }

    public decimal? ToAmount { get; init; }

    public decimal? FromTicket { get; init; }

    public decimal? ToTicket { get; init; }

    public Guid ChangedByUserId { get; init; }

    public DateTime ChangedAt { get; init; }
}
