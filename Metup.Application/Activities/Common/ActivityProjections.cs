using Metup.Application.Common.Interfaces;
using Metup.Domain.Activities;

namespace Metup.Application.Activities.Common;

/// <summary>
/// Projeção compartilhada de Activity para DTO — mesmo espírito de DealProjections, reaproveitada
/// pela timeline e pelo retorno do registro de atividade.
/// </summary>
public static class ActivityProjections
{
    public static IQueryable<ActivityDto> ToActivityDto(this IQueryable<Activity> activities, IApplicationDbContext context) =>
        activities.Select(a => new ActivityDto(
            a.Id,
            a.DealId,
            a.ContactId,
            a.ContactId == null
                ? null
                : context.Contacts.Where(c => c.Id == a.ContactId).Select(c => c.Name).FirstOrDefault(),
            a.Type,
            a.Outcome,
            a.Note,
            a.AuthorUserId,
            context.Users.Where(u => u.Id == a.AuthorUserId).Select(u => u.Name).First(),
            a.OccurredAt,
            a.CreatedAt));
}
