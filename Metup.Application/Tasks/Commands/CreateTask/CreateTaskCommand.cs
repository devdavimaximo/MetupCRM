using Metup.Application.Tasks.Common;
using Metup.Domain.Activities;
using MediatR;

namespace Metup.Application.Tasks.Commands.CreateTask;

/// <summary>
/// Cria uma tarefa sobre um negócio. Dois chamadores: a ingestão do n8n (service token, que carrega
/// só a organização) e a tela de Tarefas (<c>POST /api/tasks</c>, usuário logado).
/// </summary>
/// <param name="OwnerUserId">
/// Só vale para usuário logado: sem valor = ele mesmo; outro usuário só Admin/Closer. Pela ingestão
/// o dono é sempre o responsável atual do negócio — o token não carrega usuário.
/// </param>
public record CreateTaskCommand(
    Guid DealId,
    ActivityType Type,
    DateTime DueDate,
    string? Note,
    Guid? OwnerUserId = null) : IRequest<TaskDto>;
