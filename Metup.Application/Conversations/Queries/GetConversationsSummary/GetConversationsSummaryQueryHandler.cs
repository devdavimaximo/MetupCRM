using Metup.Application.Common.Interfaces;
using Metup.Application.Conversations.Common;
using Metup.Domain.Conversations;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Conversations.Queries.GetConversationsSummary;

public class GetConversationsSummaryQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetConversationsSummaryQuery, ConversationCountsDto>
{
    public async Task<ConversationCountsDto> Handle(GetConversationsSummaryQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        var conversations = context.Conversations
            .AsNoTracking()
            .Where(c => c.OrganizationId == organizationId);

        var total = await conversations.CountAsync(cancellationToken);

        var unread = await conversations.CountAsync(c =>
            !context.ConversationReads.Any(r => r.ConversationId == c.Id && r.UserId == userId)
                ? context.Messages.Any(m => m.ConversationId == c.Id && m.Direction == MessageDirection.Inbound)
                : context.Messages.Any(m => m.ConversationId == c.Id
                    && m.Direction == MessageDirection.Inbound
                    && m.OccurredAt > context.ConversationReads
                        .Where(r => r.ConversationId == c.Id && r.UserId == userId)
                        .Select(r => r.LastReadAt)
                        .First()),
            cancellationToken);

        var favorite = await conversations.CountAsync(c =>
            context.ConversationFavorites.Any(f => f.ConversationId == c.Id && f.UserId == userId),
            cancellationToken);

        return new ConversationCountsDto(total, unread, favorite);
    }
}
