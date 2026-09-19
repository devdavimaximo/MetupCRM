using Metup.Application.Common.Interfaces;
using Metup.Application.Tasks.Common;
using MediatR;

namespace Metup.Application.Tasks.Commands.RescheduleTask;

public class RescheduleTaskCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock) : IRequestHandler<RescheduleTaskCommand, TaskDto>
{
    public async Task<TaskDto> Handle(RescheduleTaskCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.RequireUserId();
        var task = await context.LoadForActionAsync(currentUserService, request.Id, cancellationToken);
        var clock = await organizationClock.SnapshotAsync(cancellationToken);

        context.TaskReschedules.Add(task.Reschedule(request.DueDate, userId, clock.UtcNow));

        await context.SaveChangesAsync(cancellationToken);

        return await context.LoadTaskDtoAsync(task.Id, cancellationToken);
    }
}
