namespace Metup.Application.Integrations.Common;

/// <summary>O que o n8n recebe ao consultar a fila de pendentes — payload já serializado, pronto pra ele consumir.</summary>
public record IntegrationEventDto(Guid Id, string Type, string Payload, DateTime CreatedAt);
