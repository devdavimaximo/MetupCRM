using Metup.Application.Common.Interfaces;
using Metup.Domain.Tasks;

namespace Metup.Application.Tasks.Common;

/// <summary>
/// Projeção compartilhada de TaskItem para DTO. Diferente de DealProjections/ActivityProjections,
/// usa join explícito para CompanyName porque a ligação passa por dois saltos (Task → Deal →
/// Company) — subconsulta correlacionada duplamente aninhada não compensa aqui.
/// </summary>
public static class TaskProjections
{
    public static IQueryable<TaskDto> ToTaskDto(this IQueryable<TaskItem> tasks, IApplicationDbContext context) =>
        from t in tasks
        join d in context.Deals on t.DealId equals d.Id
        join c in context.Companies on d.CompanyId equals c.Id
        join u in context.Users on t.OwnerUserId equals u.Id
        select new TaskDto(
            t.Id,
            t.DealId,
            d.CompanyId,
            c.Name,
            t.Type,
            t.DueDate,
            t.OwnerUserId,
            u.Name,
            t.Note,
            t.Status,
            t.CreatedAt,
            t.CompletedAt);
}
