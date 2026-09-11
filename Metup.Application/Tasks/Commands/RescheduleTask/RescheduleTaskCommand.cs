using Metup.Application.Tasks.Common;
using MediatR;

namespace Metup.Application.Tasks.Commands.RescheduleTask;

public record RescheduleTaskCommand(Guid Id, DateTime DueDate) : IRequest<TaskDto>;
