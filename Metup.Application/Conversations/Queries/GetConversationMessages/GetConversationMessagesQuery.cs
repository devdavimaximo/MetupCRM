using Metup.Application.Conversations.Common;
using MediatR;

namespace Metup.Application.Conversations.Queries.GetConversationMessages;

public record GetConversationMessagesQuery(Guid ConversationId) : IRequest<IReadOnlyList<MessageDto>>;
