using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Application.Conversations.Common;
using Metup.Domain.Conversations;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Conversations.Queries.ListConversations;

public class ListConversationsQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<ListConversationsQuery, PagedResult<ConversationListItemDto>>
{
    public async Task<PagedResult<ConversationListItemDto>> Handle(
        ListConversationsQuery request,
        CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        var query = context.Conversations
            .AsNoTracking()
            .Where(c => c.OrganizationId == organizationId);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim();
            query = query.Where(c =>
                context.Contacts.Any(ct => ct.Id == c.ContactId && ct.Name.Contains(search)) ||
                context.Contacts.Any(ct => ct.Id == c.ContactId &&
                    context.Companies.Any(co => co.Id == ct.CompanyId && co.Name.Contains(search))));
        }

        if (request.Channel is { Count: > 0 } channels)
        {
            query = query.Where(c => channels.Contains(c.Channel));
        }

        if (request.Status is { Count: > 0 } statuses)
        {
            query = query.Where(c => statuses.Contains(c.Status));
        }

        if (request.Favorite is { } favorite)
        {
            query = favorite
                ? query.Where(c => context.ConversationFavorites.Any(f => f.ConversationId == c.Id && f.UserId == userId))
                : query.Where(c => !context.ConversationFavorites.Any(f => f.ConversationId == c.Id && f.UserId == userId));
        }

        if (request.Unread is { } unread)
        {
            query = unread
                ? query.Where(c =>
                    !context.ConversationReads.Any(r => r.ConversationId == c.Id && r.UserId == userId)
                        ? context.Messages.Any(m => m.ConversationId == c.Id && m.Direction == MessageDirection.Inbound)
                        : context.Messages.Any(m => m.ConversationId == c.Id
                            && m.Direction == MessageDirection.Inbound
                            && m.OccurredAt > context.ConversationReads
                                .Where(r => r.ConversationId == c.Id && r.UserId == userId)
                                .Select(r => r.LastReadAt)
                                .First()))
                : query.Where(c =>
                    context.ConversationReads.Any(r => r.ConversationId == c.Id && r.UserId == userId)
                        && !context.Messages.Any(m => m.ConversationId == c.Id
                            && m.Direction == MessageDirection.Inbound
                            && m.OccurredAt > context.ConversationReads
                                .Where(r => r.ConversationId == c.Id && r.UserId == userId)
                                .Select(r => r.LastReadAt)
                                .First()));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(c => c.LastMessageAt ?? c.CreatedAt)
            .ThenBy(c => c.Id)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListItemDto(context, userId)
            .ToListAsync(cancellationToken);

        var tagsByConversation = await ConversationProjections.LoadTagNamesAsync(
            context, [.. items.Select(i => i.Id)], cancellationToken);

        var withTags = items
            .Select(i => tagsByConversation.TryGetValue(i.Id, out var tags) ? i with { Tags = tags } : i)
            .ToList();

        return new PagedResult<ConversationListItemDto>(withTags, request.Page, request.PageSize, totalCount);
    }
}
