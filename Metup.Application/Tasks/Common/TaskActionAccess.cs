using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Domain.Tasks;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Tasks.Common;

/// <summary>
/// Carrega a tarefa alvo de uma ação por linha já aplicando a permissão de
/// <see cref="CurrentUserServiceExtensions.ResolveTaskActionScope"/>: fora da organização é 404
/// (não vaza existência); dentro dela mas fora do escopo do usuário (SDR em tarefa alheia) é 403.
/// </summary>
public static class TaskActionAccess
{
    public static async Task<TaskItem> LoadForActionAsync(
        this IApplicationDbContext context,
        ICurrentUserService currentUserService,
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var scope = currentUserService.ResolveTaskActionScope();

        var task = await context.Tasks
            .FirstOrDefaultAsync(t => t.Id == taskId && t.OrganizationId == scope.OrganizationId, cancellationToken)
            ?? throw new NotFoundException("Tarefa");

        if (scope.OwnerUserId is { } ownerUserId && task.OwnerUserId != ownerUserId)
        {
            throw new ForbiddenAccessException("Sem permissão para alterar a tarefa de outro usuário.");
        }

        return task;
    }

    public static Task<bool> OwnerBelongsToOrganizationAsync(
        this IApplicationDbContext context,
        Guid ownerUserId,
        Guid organizationId,
        CancellationToken cancellationToken) =>
        context.Users.AnyAsync(u => u.Id == ownerUserId && u.OrganizationId == organizationId, cancellationToken);

    /// <summary>A mesma tarefa já gravada, no formato da tela.</summary>
    public static Task<TaskDto> LoadTaskDtoAsync(
        this IApplicationDbContext context,
        Guid taskId,
        CancellationToken cancellationToken) =>
        context.Tasks
            .AsNoTracking()
            .Where(t => t.Id == taskId)
            .ToTaskDto(context)
            .FirstAsync(cancellationToken);
}
