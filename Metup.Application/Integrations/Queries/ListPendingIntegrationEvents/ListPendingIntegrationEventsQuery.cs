using Metup.Application.Integrations.Common;
using MediatR;

namespace Metup.Application.Integrations.Queries.ListPendingIntegrationEvents;

public record ListPendingIntegrationEventsQuery(int Limit = 50) : IRequest<IReadOnlyList<IntegrationEventDto>>;
