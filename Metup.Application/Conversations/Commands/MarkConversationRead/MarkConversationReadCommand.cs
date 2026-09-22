using MediatR;

namespace Metup.Application.Conversations.Commands.MarkConversationRead;

public record MarkConversationReadCommand(Guid ConversationId) : IRequest;
