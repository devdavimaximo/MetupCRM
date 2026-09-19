using Metup.Application.Common.Interfaces;
using Metup.Application.Tasks.Common;
using Metup.Application.Common.Realtime;
using MediatR;

namespace Metup.Application.Tasks.Commands.CompleteTask;

public class CompleteTaskCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock,
    IPublisher publisher) : IRequestHandler<CompleteTaskCommand, TaskDto>
{
    public async Task<TaskDto> Handle(CompleteTaskCommand request, CancellationToken cancellationToken)
    {
        var task = await context.LoadForActionAsync(currentUserService, request.Id, cancellationToken);
        var clock = await organizationClock.SnapshotAsync(cancellationToken);

        task.Complete(clock.UtcNow);

        await context.SaveChangesAsync(cancellationToken);
        await publisher.Publish(new TaskCompletedNotification(task.OrganizationId, task.DealId, task.OwnerUserId), cancellationToken);

        return await context.LoadTaskDtoAsync(task.Id, cancellationToken);
    }
}
