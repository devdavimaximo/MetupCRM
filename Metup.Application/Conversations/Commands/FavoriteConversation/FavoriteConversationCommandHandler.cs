using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Realtime;
using Metup.Domain.Conversations;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Conversations.Commands.FavoriteConversation;

/// <summary>Idempotente: favoritar de novo uma conversa já favorita não duplica.</summary>
public class FavoriteConversationCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IPublisher publisher) : IRequestHandler<FavoriteConversationCommand>
{
    public async Task Handle(FavoriteConversationCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        var conversationExists = await context.Conversations
            .AnyAsync(c => c.Id == request.ConversationId && c.OrganizationId == organizationId, cancellationToken);
        if (!conversationExists)
        {
            throw new NotFoundException("Conversa");
        }

        var alreadyFavorite = await context.ConversationFavorites
            .AnyAsync(f => f.ConversationId == request.ConversationId && f.UserId == userId, cancellationToken);

        if (!alreadyFavorite)
        {
            context.ConversationFavorites.Add(new ConversationFavorite
            {
                OrganizationId = organizationId,
                ConversationId = request.ConversationId,
                UserId = userId,
            });

            await context.SaveChangesAsync(cancellationToken);
            await publisher.Publish(new ConversationFavoritedNotification(organizationId, request.ConversationId, userId), cancellationToken);
        }
    }
}
