using Metup.Application.Tasks.Common;
using MediatR;

namespace Metup.Application.Tasks.Commands.BulkTask;

public enum BulkTaskAction
{
    Complete,
    Cancel,
    Reschedule,
    Reassign,
}

/// <summary>
/// Uma ação sobre várias tarefas numa transação só. Cada item falha por conta própria (sem derrubar
/// o lote); repetir o mesmo pedido devolve os já fechados como <see cref="BulkTaskFailureReason.NotPending"/>.
/// </summary>
/// <param name="DueDate">Obrigatório em <see cref="BulkTaskAction.Reschedule"/>.</param>
/// <param name="OwnerUserId">Obrigatório em <see cref="BulkTaskAction.Reassign"/>.</param>
public record BulkTaskCommand(
    IReadOnlyList<Guid> Ids,
    BulkTaskAction Action,
    DateTime? DueDate = null,
    Guid? OwnerUserId = null) : IRequest<BulkTaskResultDto>;

public enum BulkTaskFailureReason
{
    /// <summary>Inexistente, de outra organização ou fora do escopo do usuário — indistinguíveis de propósito.</summary>
    NotFound,

    /// <summary>Já concluída ou cancelada.</summary>
    NotPending,
}

public record BulkTaskFailureDto(Guid Id, BulkTaskFailureReason Reason);

public record BulkTaskResultDto(IReadOnlyList<TaskDto> Succeeded, IReadOnlyList<BulkTaskFailureDto> Failed);
