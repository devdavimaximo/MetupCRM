using Metup.Application.Common.Interfaces;
using Metup.Domain.Conversations;

namespace Metup.Application.Conversations.Common;

/// <summary>
/// Projeção compartilhada de Conversation/Message para DTO — mesmo espírito de
/// <c>Metup.Application.Deals.Common.DealProjections</c>: um único Select reaproveitado por
/// query e command, em vez de duplicar o join em cada handler.
/// </summary>
public static class ConversationProjections
{
    public static IQueryable<ConversationListItemDto> ToListItemDto(
        this IQueryable<Conversation> conversations, IApplicationDbContext context) =>
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
            c.CreatedAt);

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
            m.OccurredAt));
}
