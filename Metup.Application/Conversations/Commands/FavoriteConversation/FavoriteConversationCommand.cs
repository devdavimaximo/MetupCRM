using MediatR;

namespace Metup.Application.Conversations.Commands.FavoriteConversation;

public record FavoriteConversationCommand(Guid ConversationId) : IRequest;
