using MediatR;

namespace Metup.Application.Conversations.Commands.SetConversationAutomation;

public record SetConversationAutomationCommand(Guid ConversationId, bool Enabled) : IRequest;
