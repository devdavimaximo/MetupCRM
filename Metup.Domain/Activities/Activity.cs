using Metup.Domain.Common;
using Metup.Domain.Common.Exceptions;

namespace Metup.Domain.Activities;

/// <summary>
/// Toda interação com um negócio é registrada aqui — tipo e desfecho sempre enum, nunca texto
/// livre (regra 4.3 do CLAUDE.md). É o que torna a timeline e as métricas do funil calculáveis.
/// </summary>
public class Activity : BaseEntity
{
    public Guid DealId { get; set; }

    /// <summary>Informado quando a interação foi diretamente com uma pessoa da empresa.</summary>
    public Guid? ContactId { get; set; }

    public ActivityType Type { get; set; }

    /// <summary>Nulo para tipos sem desfecho estruturado (ex.: Note).</summary>
    public ActivityOutcome? Outcome { get; set; }

    public string? Note { get; set; }

    public Guid AuthorUserId { get; set; }

    /// <summary>
    /// Linha de onde a ligação saiu (discador). Só em <see cref="ActivityType.Call"/>; nula nas
    /// ligações registradas à mão, sem linha escolhida.
    /// </summary>
    public Guid? PhoneLineId { get; set; }

    public DateTime OccurredAt { get; set; }

    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

    public static Activity Log(
        Guid organizationId,
        Guid dealId,
        Guid? contactId,
        ActivityType type,
        ActivityOutcome? outcome,
        string? note,
        Guid authorUserId,
        DateTime occurredAt,
        Guid? phoneLineId = null)
    {
        if (type == ActivityType.Call && outcome is null)
        {
            throw new DomainRuleException("Toda ligação precisa de um desfecho estruturado.");
        }

        if (phoneLineId is not null && type != ActivityType.Call)
        {
            throw new DomainRuleException("Só ligações registram a linha usada.");
        }

        return new Activity
        {
            OrganizationId = organizationId,
            DealId = dealId,
            ContactId = contactId,
            Type = type,
            Outcome = outcome,
            Note = note,
            AuthorUserId = authorUserId,
            PhoneLineId = phoneLineId,
            OccurredAt = occurredAt,
        };
    }
}
