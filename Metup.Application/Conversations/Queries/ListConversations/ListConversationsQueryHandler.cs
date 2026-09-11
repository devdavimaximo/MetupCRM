using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Application.Conversations.Common;
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

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(c => c.LastMessageAt ?? c.CreatedAt)
            .ThenBy(c => c.Id)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListItemDto(context)
            .ToListAsync(cancellationToken);

        return new PagedResult<ConversationListItemDto>(items, request.Page, request.PageSize, totalCount);
    }
}
