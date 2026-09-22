using MediatR;

namespace Metup.Application.Conversations.Commands.RemoveConversationTag;

public record RemoveConversationTagCommand(Guid ConversationId, Guid TagOptionId) : IRequest;
