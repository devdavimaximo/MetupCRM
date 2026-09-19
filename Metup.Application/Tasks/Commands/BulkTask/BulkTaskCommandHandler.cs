using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Realtime;
using Metup.Application.Tasks.Common;
using Metup.Domain.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Tasks.Commands.BulkTask;

/// <summary>
/// Aplica a ação pelo domínio, tarefa a tarefa, e grava tudo num único <c>SaveChanges</c> (uma
/// transação). Só entram tarefas da organização <b>e</b> do escopo de ação do usuário
/// (<see cref="CurrentUserServiceExtensions.ResolveTaskActionScope"/>); o resto volta como
/// <see cref="BulkTaskFailureReason.NotFound"/>, sem revelar se existe.
/// </summary>
public class BulkTaskCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock,
    IPublisher publisher) : IRequestHandler<BulkTaskCommand, BulkTaskResultDto>
{
    public async Task<BulkTaskResultDto> Handle(BulkTaskCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.RequireUserId();
        var scope = currentUserService.ResolveTaskActionScope();

        if (request.Action == BulkTaskAction.Reassign)
        {
            currentUserService.RequireTaskReassign();

            if (!await context.OwnerBelongsToOrganizationAsync(request.OwnerUserId!.Value, scope.OrganizationId, cancellationToken))
            {
                throw new NotFoundException("Responsável");
            }
        }

        var clock = await organizationClock.SnapshotAsync(cancellationToken);
        var ids = request.Ids.Distinct().ToList();

        var tasks = await context.Tasks
            .OwnedBy(scope)
            .Where(t => ids.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, cancellationToken);

        var succeeded = new List<TaskItem>();
        var failed = new List<BulkTaskFailureDto>();

        foreach (var id in ids)
        {
            if (!tasks.TryGetValue(id, out var task))
            {
                failed.Add(new BulkTaskFailureDto(id, BulkTaskFailureReason.NotFound));
                continue;
            }

            if (!task.IsPending)
            {
                failed.Add(new BulkTaskFailureDto(id, BulkTaskFailureReason.NotPending));
                continue;
            }

            Apply(task, request, userId, clock.UtcNow);
            succeeded.Add(task);
        }

        if (succeeded.Count > 0)
        {
            await context.SaveChangesAsync(cancellationToken);
        }

        if (request.Action == BulkTaskAction.Complete)
        {
            foreach (var target in succeeded.Select(t => (t.DealId, t.OwnerUserId)).Distinct())
            {
                await publisher.Publish(new TaskCompletedNotification(scope.OrganizationId, target.DealId, target.OwnerUserId), cancellationToken);
            }
        }

        var succeededIds = succeeded.Select(t => t.Id).ToList();
        var dtos = await context.Tasks
            .AsNoTracking()
            .Where(t => succeededIds.Contains(t.Id))
            .ToTaskDto(context)
            .ToDictionaryAsync(t => t.Id, cancellationToken);

        return new BulkTaskResultDto(succeededIds.Select(id => dtos[id]).ToList(), failed);
    }

    private void Apply(TaskItem task, BulkTaskCommand request, Guid userId, DateTime nowUtc)
    {
        switch (request.Action)
        {
            case BulkTaskAction.Complete:
                task.Complete(nowUtc);
                break;
            case BulkTaskAction.Cancel:
                task.Cancel(nowUtc);
                break;
            case BulkTaskAction.Reschedule:
                context.TaskReschedules.Add(task.Reschedule(request.DueDate!.Value, userId, nowUtc));
                break;
            case BulkTaskAction.Reassign:
                task.Reassign(request.OwnerUserId!.Value);
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(request), request.Action, "Ação em massa desconhecida.");
        }
    }
}
