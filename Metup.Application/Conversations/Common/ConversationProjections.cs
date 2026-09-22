using Metup.Application.Common.Interfaces;
using Metup.Domain.Conversations;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Conversations.Common;

/// <summary>
/// Projeção compartilhada de Conversation/Message para DTO — mesmo espírito de
/// <c>Metup.Application.Deals.Common.DealProjections</c>: um único Select reaproveitado por
/// query e command, em vez de duplicar o join em cada handler.
/// </summary>
public static class ConversationProjections
{
    /// <summary>
    /// Tags não entram no Select principal (evitaria um <c>ToList()</c> correlacionado sobre
    /// tabelas sem navegação, que o provider nem sempre traduz de forma previsível) — os
    /// handlers materializam a página e chamam <see cref="LoadTagNamesAsync"/> à parte,
    /// devolvendo <c>[]</c> aqui como placeholder.
    /// </summary>
    public static IQueryable<ConversationListItemDto> ToListItemDto(
        this IQueryable<Conversation> conversations, IApplicationDbContext context, Guid currentUserId) =>
        from c in conversations
        join contact in context.Contacts on c.ContactId equals contact.Id
        join company in context.Companies on contact.CompanyId equals company.Id
        select new ConversationListItemDto(
            c.Id,
            c.ContactId,
            contact.Name,
            company.Id,
            company.Name,
            context.Messages
                .Where(m => m.ConversationId == c.Id)
                .OrderByDescending(m => m.OccurredAt)
                .Select(m => m.Body)
                .FirstOrDefault(),
            c.LastMessageAt,
            c.CreatedAt,
            c.Channel,
            c.Status,
            !context.ConversationReads.Any(r => r.ConversationId == c.Id && r.UserId == currentUserId)
                ? context.Messages.Any(m => m.ConversationId == c.Id && m.Direction == MessageDirection.Inbound)
                : context.Messages.Any(m => m.ConversationId == c.Id
                    && m.Direction == MessageDirection.Inbound
                    && m.OccurredAt > context.ConversationReads
                        .Where(r => r.ConversationId == c.Id && r.UserId == currentUserId)
                        .Select(r => r.LastReadAt)
                        .First()),
            context.ConversationFavorites.Any(f => f.ConversationId == c.Id && f.UserId == currentUserId),
            Array.Empty<string>());

    /// <summary>Carrega os nomes de tag aplicados a um conjunto de conversas, agrupados por conversa.</summary>
    public static async Task<Dictionary<Guid, IReadOnlyList<string>>> LoadTagNamesAsync(
        IApplicationDbContext context, IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken)
    {
        if (conversationIds.Count == 0)
        {
            return [];
        }

        var rows = await context.ConversationTags
            .Where(t => conversationIds.Contains(t.ConversationId))
            .Join(context.ConversationTagOptions, t => t.TagOptionId, o => o.Id, (t, o) => new { t.ConversationId, o.Name })
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(r => r.ConversationId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<string>)[.. g.Select(r => r.Name).OrderBy(n => n)]);
    }

    public static IQueryable<MessageDto> ToMessageDto(this IQueryable<Message> messages, IApplicationDbContext context) =>
        messages.Select(m => new MessageDto(
            m.Id,
            m.ConversationId,
            m.Direction,
            m.Body,
            m.AuthorUserId,
            m.AuthorUserId == null
                ? null
                : context.Users.Where(u => u.Id == m.AuthorUserId).Select(u => u.Name).FirstOrDefault(),
            m.DealId,
            m.DealStageAtMessage,
            m.OccurredAt,
            m.AuthorKind,
            m.Attachments
                .Select(a => new MessageAttachmentDto(a.Kind, a.Url, a.FileName, a.MimeType, a.SizeBytes))
                .ToList()));
}
