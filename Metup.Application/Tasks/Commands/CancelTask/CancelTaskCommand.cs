using Metup.Application.Tasks.Common;
using MediatR;

namespace Metup.Application.Tasks.Commands.CancelTask;

public record CancelTaskCommand(Guid Id) : IRequest<TaskDto>;
