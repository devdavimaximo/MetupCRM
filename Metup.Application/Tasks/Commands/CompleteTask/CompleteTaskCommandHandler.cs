using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Tasks.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Tasks.Commands.CompleteTask;

public class CompleteTaskCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<CompleteTaskCommand, TaskDto>
{
    public async Task<TaskDto> Handle(CompleteTaskCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var task = await context.Tasks
            .FirstOrDefaultAsync(t => t.Id == request.Id && t.OrganizationId == organizationId, cancellationToken)
            ?? throw new NotFoundException("Tarefa");

        task.Complete(DateTime.UtcNow);

        await context.SaveChangesAsync(cancellationToken);

        return await context.Tasks
            .AsNoTracking()
            .Where(t => t.Id == task.Id)
            .ToTaskDto(context)
            .FirstAsync(cancellationToken);
    }
}
