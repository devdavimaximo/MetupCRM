using Metup.Domain.Conversations;
using MediatR;

namespace Metup.Application.Conversations.Commands.UpdateConversationStatus;

public record UpdateConversationStatusCommand(Guid ConversationId, ConversationStatus Status) : IRequest;
