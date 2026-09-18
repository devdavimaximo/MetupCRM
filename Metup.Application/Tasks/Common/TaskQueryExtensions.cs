using Metup.Application.Common.Models;
using Metup.Domain.Tasks;

namespace Metup.Application.Tasks.Common;

public static class TaskQueryExtensions
{
    /// <summary>Aplica o escopo resolvido por <c>ResolveTaskOwnerScope</c>: organização e, se houver, o responsável.</summary>
    public static IQueryable<TaskItem> OwnedBy(this IQueryable<TaskItem> tasks, TaskOwnerFilter filter)
    {
        var scoped = tasks.Where(t => t.OrganizationId == filter.OrganizationId);

        return filter.OwnerUserId is { } ownerUserId
            ? scoped.Where(t => t.OwnerUserId == ownerUserId)
            : scoped;
    }
}
