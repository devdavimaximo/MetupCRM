using Metup.Domain.Common;
using Metup.Domain.Common.Exceptions;

namespace Metup.Domain.Deals;

/// <summary>
/// Item de pipeline: a espinha do funil (seção 6 do CLAUDE.md). Mover o negócio de estágio e
/// registrar o StageChange correspondente são uma única operação de domínio — nunca dois
/// passos espalhados por handlers de aplicação (regra "estágios são first-class").
/// </summary>
public class Deal : BaseEntity
{
    public Guid CompanyId { get; set; }

    public Guid? ContactId { get; set; }

    public DealStage Stage { get; private set; }

    public DealSource Source { get; set; }

    public Guid OwnerUserId { get; set; }

    /// <summary>Ticket estimado ao entrar no funil — nunca <c>float</c> (regra 4.7).</summary>
    public decimal? Ticket { get; set; }

    /// <summary>Valor em negociação; vira o valor fechado quando o negócio é ganho.</summary>
    public decimal? Amount { get; set; }

    public DealStatus Status { get; private set; } = DealStatus.Aberto;

    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

    public DateTime? ClosedAt { get; private set; }

    public ICollection<StageChange> StageChanges { get; init; } = [];

    public static Deal Create(
        Guid organizationId,
        Guid companyId,
        Guid? contactId,
        DealStage initialStage,
        DealSource source,
        Guid ownerUserId,
        decimal? ticket,
        decimal? amount,
        Guid createdByUserId,
        DateTime nowUtc)
    {
        if (IsTerminalStage(initialStage))
        {
            throw new DomainRuleException("Um negócio não pode nascer já ganho ou perdido.");
        }

        var deal = new Deal
        {
            OrganizationId = organizationId,
            CompanyId = companyId,
            ContactId = contactId,
            Stage = initialStage,
            Source = source,
            OwnerUserId = ownerUserId,
            Ticket = ticket,
            Amount = amount,
        };

        deal.StageChanges.Add(new StageChange
        {
            OrganizationId = organizationId,
            DealId = deal.Id,
            FromStage = null,
            ToStage = initialStage,
            ChangedAt = nowUtc,
            ChangedByUserId = createdByUserId,
        });

        return deal;
    }

    /// <summary>
    /// Move o negócio entre estágios ativos do funil. Fechamento é feito por <see cref="Close"/>.
    /// Devolve o StageChange criado — quem chama precisa rastreá-lo explicitamente no
    /// contexto (<c>context.StageChanges.Add(...)</c>), já que descoberta via navegação
    /// de um Guid já atribuído não é reconhecida pelo EF Core como "novo" (viraria UPDATE).
    /// </summary>
    public StageChange ChangeStage(DealStage newStage, Guid changedByUserId, DateTime nowUtc)
    {
        EnsureOpen();

        if (IsTerminalStage(newStage))
        {
            throw new DomainRuleException("Para fechar o negócio como ganho ou perdido, use o fechamento do negócio.");
        }

        if (newStage == Stage)
        {
            throw new DomainRuleException("O negócio já está neste estágio.");
        }

        return RecordStageChange(newStage, changedByUserId, nowUtc);
    }

    /// <summary>
    /// Fecha o negócio (ganho ou perdido), registrando a transição de estágio e o valor final.
    /// Devolve o StageChange criado — mesma observação de rastreamento explícito de <see cref="ChangeStage"/>.
    /// </summary>
    public StageChange Close(bool won, decimal? closedAmount, Guid changedByUserId, DateTime nowUtc)
    {
        EnsureOpen();

        var finalStage = won ? DealStage.Ganho : DealStage.Perdido;
        var stageChange = RecordStageChange(finalStage, changedByUserId, nowUtc);

        Status = won ? DealStatus.Ganho : DealStatus.Perdido;
        ClosedAt = nowUtc;

        if (closedAmount.HasValue)
        {
            Amount = closedAmount.Value;
        }

        return stageChange;
    }

    private StageChange RecordStageChange(DealStage newStage, Guid changedByUserId, DateTime nowUtc)
    {
        var stageChange = new StageChange
        {
            OrganizationId = OrganizationId,
            DealId = Id,
            FromStage = Stage,
            ToStage = newStage,
            ChangedAt = nowUtc,
            ChangedByUserId = changedByUserId,
        };

        StageChanges.Add(stageChange);
        Stage = newStage;

        return stageChange;
    }

    private void EnsureOpen()
    {
        if (Status != DealStatus.Aberto)
        {
            throw new DomainRuleException("O negócio já está fechado — não é possível mudar o estágio.");
        }
    }

    private static bool IsTerminalStage(DealStage stage) => stage is DealStage.Ganho or DealStage.Perdido;
}
