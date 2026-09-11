using MediatR;

namespace Metup.Application.Integrations.Commands.RotateIntegrationToken;

public record RotateIntegrationTokenCommand : IRequest<RotateIntegrationTokenResult>;

/// <param name="Token">Texto puro, devolvido uma única vez — o Davi copia daqui pro n8n configurar.</param>
public record RotateIntegrationTokenResult(string Token);
