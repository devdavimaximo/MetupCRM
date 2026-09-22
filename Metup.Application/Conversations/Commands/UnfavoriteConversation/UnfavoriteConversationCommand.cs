using MediatR;

namespace Metup.Application.Conversations.Commands.UnfavoriteConversation;

public record UnfavoriteConversationCommand(Guid ConversationId) : IRequest;
