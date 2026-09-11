using Metup.Application.Conversations.Common;
using MediatR;

namespace Metup.Application.Conversations.Commands.SendMessage;

public record SendMessageCommand(Guid ConversationId, string Body) : IRequest<MessageDto>;
