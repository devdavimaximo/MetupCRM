using MediatR;

namespace Metup.Application.Integrations.Commands.AckIntegrationEvent;

public record AckIntegrationEventCommand(Guid EventId) : IRequest;
