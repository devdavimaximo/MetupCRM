using Metup.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Conversations.Commands.UnfavoriteConversation;

/// <summary>Idempotente: desfavoritar sem ter favoritado não é erro.</summary>
public class UnfavoriteConversationCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<UnfavoriteConversationCommand>
{
    public async Task Handle(UnfavoriteConversationCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        var favorite = await context.ConversationFavorites
            .Where(f => f.ConversationId == request.ConversationId
                && f.UserId == userId
                && f.OrganizationId == organizationId)
            .FirstOrDefaultAsync(cancellationToken);

        if (favorite is not null)
        {
            context.ConversationFavorites.Remove(favorite);
            await context.SaveChangesAsync(cancellationToken);
        }
    }
}
