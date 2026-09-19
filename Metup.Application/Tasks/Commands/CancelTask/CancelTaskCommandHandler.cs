using Metup.Application.Common.Interfaces;
using Metup.Application.Tasks.Common;
using MediatR;

namespace Metup.Application.Tasks.Commands.CancelTask;

public class CancelTaskCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock) : IRequestHandler<CancelTaskCommand, TaskDto>
{
    public async Task<TaskDto> Handle(CancelTaskCommand request, CancellationToken cancellationToken)
    {
        var task = await context.LoadForActionAsync(currentUserService, request.Id, cancellationToken);
        var clock = await organizationClock.SnapshotAsync(cancellationToken);

        task.Cancel(clock.UtcNow);

        await context.SaveChangesAsync(cancellationToken);

        return await context.LoadTaskDtoAsync(task.Id, cancellationToken);
    }
}
