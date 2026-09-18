using Metup.Domain.Common;

namespace Metup.Domain.Tasks;

/// <summary>
/// Histórico de reagendamento de uma tarefa (regra 4.6: o histórico comercial nunca se perde).
/// Sem ele, <see cref="TaskItem.DueDate"/> sobrescrito apagaria o prazo que estava valendo — e
/// "quantas estavam atrasadas na semana passada" deixaria de ser reconstruível.
/// </summary>
public class TaskReschedule : BaseEntity
{
    public Guid TaskId { get; init; }

    public DateTime FromDueDate { get; init; }

    public DateTime ToDueDate { get; init; }

    public Guid RescheduledByUserId { get; init; }

    public DateTime RescheduledAt { get; init; }
}
