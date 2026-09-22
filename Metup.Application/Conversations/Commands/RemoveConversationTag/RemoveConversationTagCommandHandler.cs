using Metup.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Conversations.Commands.RemoveConversationTag;

/// <summary>Remove só a aplicação na conversa — o catálogo (ConversationTagOption) continua existindo.</summary>
public class RemoveConversationTagCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<RemoveConversationTagCommand>
{
    public async Task Handle(RemoveConversationTagCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var tag = await context.ConversationTags
            .Where(t => t.ConversationId == request.ConversationId
                && t.TagOptionId == request.TagOptionId
                && t.OrganizationId == organizationId)
            .FirstOrDefaultAsync(cancellationToken);

        if (tag is not null)
        {
            context.ConversationTags.Remove(tag);
            await context.SaveChangesAsync(cancellationToken);
        }
    }
}
