using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Conversations.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Conversations.Queries.GetConversationMessages;

public class GetConversationMessagesQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetConversationMessagesQuery, IReadOnlyList<MessageDto>>
{
    public async Task<IReadOnlyList<MessageDto>> Handle(GetConversationMessagesQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var conversationExists = await context.Conversations
            .AnyAsync(c => c.Id == request.ConversationId && c.OrganizationId == organizationId, cancellationToken);
        if (!conversationExists)
        {
            throw new NotFoundException("Conversa");
        }

        return await context.Messages
            .AsNoTracking()
            .Where(m => m.ConversationId == request.ConversationId)
            .OrderBy(m => m.OccurredAt)
            .ToMessageDto(context)
            .ToListAsync(cancellationToken);
    }
}
