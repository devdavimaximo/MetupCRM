using Metup.Application.Conversations.Common;
using MediatR;

namespace Metup.Application.Conversations.Queries.GetConversationContext;

public record GetConversationContextQuery(Guid ConversationId) : IRequest<ConversationContextDto>;
