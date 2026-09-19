using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Tasks.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Tasks.Commands.ReassignTask;

/// <summary>
/// O destino precisa ser da mesma organização (404 genérico). <c>User</c> não tem "ativo": qualquer
/// usuário da organização é destino válido — registrado como achado, sem inventar o campo.
/// </summary>
public class ReassignTaskCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<ReassignTaskCommand, TaskDto>
{
    public async Task<TaskDto> Handle(ReassignTaskCommand request, CancellationToken cancellationToken)
    {
        currentUserService.RequireTaskReassign();

        var task = await context.LoadForActionAsync(currentUserService, request.Id, cancellationToken);

        if (!await context.OwnerBelongsToOrganizationAsync(request.OwnerUserId, task.OrganizationId, cancellationToken))
        {
            throw new NotFoundException("Responsável");
        }

        task.Reassign(request.OwnerUserId);

        await context.SaveChangesAsync(cancellationToken);

        return await context.LoadTaskDtoAsync(task.Id, cancellationToken);
    }
}
