using MediatR;

namespace Metup.Application.Conversations.Commands.MarkConversationUnread;

public record MarkConversationUnreadCommand(Guid ConversationId) : IRequest;
