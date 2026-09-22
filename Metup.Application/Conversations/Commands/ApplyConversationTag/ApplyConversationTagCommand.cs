using MediatR;

namespace Metup.Application.Conversations.Commands.ApplyConversationTag;

public record ApplyConversationTagCommand(Guid ConversationId, string Name) : IRequest;
