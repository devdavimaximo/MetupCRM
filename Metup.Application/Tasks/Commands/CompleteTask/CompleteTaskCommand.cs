using Metup.Application.Tasks.Common;
using MediatR;

namespace Metup.Application.Tasks.Commands.CompleteTask;

public record CompleteTaskCommand(Guid Id) : IRequest<TaskDto>;
