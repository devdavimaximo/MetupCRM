using Metup.Application.Tasks.Common;
using MediatR;

namespace Metup.Application.Tasks.Commands.ReassignTask;

/// <summary>Passa a tarefa para outro responsável da organização. Só Admin/Closer.</summary>
public record ReassignTaskCommand(Guid Id, Guid OwnerUserId) : IRequest<TaskDto>;
