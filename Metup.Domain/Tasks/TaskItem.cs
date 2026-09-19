using Metup.Domain.Activities;
using Metup.Domain.Common;
using Metup.Domain.Common.Exceptions;

namespace Metup.Domain.Tasks;

/// <summary>
/// Próxima ação agendada sobre um negócio (seção 3.5 do CLAUDE.md) — o que alimenta o
/// "hoje você tem N contatos que precisam de follow-up". Chamada de <c>TaskItem</c>, não
/// <c>Task</c>, para não colidir com <see cref="System.Threading.Tasks.Task"/>.
/// </summary>
public class TaskItem : BaseEntity
{
    public Guid DealId { get; set; }

    /// <summary>Reaproveita ActivityType: a próxima ação é do mesmo vocabulário da atividade.</summary>
    public ActivityType Type { get; set; }

    public DateTime DueDate { get; set; }

    public Guid OwnerUserId { get; set; }

    public string? Note { get; set; }

    public TaskItemStatus Status { get; private set; } = TaskItemStatus.Pendente;

    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

    public DateTime? CompletedAt { get; private set; }

    public static TaskItem Create(
        Guid organizationId,
        Guid dealId,
        ActivityType type,
        DateTime dueDate,
        Guid ownerUserId,
        string? note) =>
        new()
        {
            OrganizationId = organizationId,
            DealId = dealId,
            Type = type,
            DueDate = dueDate,
            OwnerUserId = ownerUserId,
            Note = note,
        };

    public void Complete(DateTime nowUtc)
    {
        EnsurePending();

        Status = TaskItemStatus.Concluida;
        CompletedAt = nowUtc;
    }

    public void Cancel(DateTime nowUtc)
    {
        EnsurePending();

        Status = TaskItemStatus.Cancelada;
        CompletedAt = nowUtc;
    }

    /// <summary>
    /// Muda o prazo e devolve o registro de histórico. Quem chama precisa adicioná-lo ao contexto
    /// (<c>context.TaskReschedules.Add(...)</c>) — mesmo contrato de <c>Deal.ChangeStage</c>.
    /// </summary>
    public TaskReschedule Reschedule(DateTime newDueDate, Guid rescheduledByUserId, DateTime nowUtc)
    {
        EnsurePending();

        if (newDueDate < nowUtc)
        {
            throw new DomainRuleException("A nova data da tarefa não pode ser no passado.");
        }

        var reschedule = new TaskReschedule
        {
            OrganizationId = OrganizationId,
            TaskId = Id,
            FromDueDate = DueDate,
            ToDueDate = newDueDate,
            RescheduledByUserId = rescheduledByUserId,
            RescheduledAt = nowUtc,
        };

        DueDate = newDueDate;

        return reschedule;
    }

    /// <summary>
    /// Passa a tarefa para outro responsável. Só tarefa pendente; o mesmo dono é no-op. Sem
    /// histórico de responsável: nenhuma métrica depende dele por enquanto.
    /// </summary>
    public void Reassign(Guid newOwnerUserId)
    {
        EnsurePending();

        OwnerUserId = newOwnerUserId;
    }

    public bool IsPending => Status == TaskItemStatus.Pendente;

    private void EnsurePending()
    {
        if (Status != TaskItemStatus.Pendente)
        {
            throw new DomainRuleException("A tarefa já foi concluída ou cancelada.");
        }
    }
}
