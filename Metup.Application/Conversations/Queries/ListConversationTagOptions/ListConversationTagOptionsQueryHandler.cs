using Metup.Application.Common.Interfaces;
using Metup.Application.Conversations.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Conversations.Queries.ListConversationTagOptions;

public class ListConversationTagOptionsQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<ListConversationTagOptionsQuery, IReadOnlyList<ConversationTagOptionDto>>
{
    public async Task<IReadOnlyList<ConversationTagOptionDto>> Handle(
        ListConversationTagOptionsQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var query = context.ConversationTagOptions
            .AsNoTracking()
            .Where(t => t.OrganizationId == organizationId);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var normalized = request.Search.Trim().ToLowerInvariant();
            query = query.Where(t => t.NormalizedName.Contains(normalized));
        }

        return await query
            .OrderBy(t => t.Name)
            .Select(t => new ConversationTagOptionDto(t.Id, t.Name))
            .ToListAsync(cancellationToken);
    }
}
