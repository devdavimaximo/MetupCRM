namespace Metup.Domain.Integrations;

/// <summary>
/// Nomes dos eventos de saída que o n8n assina (seção 5 do CLAUDE.md, mesmo vocabulário de
/// exemplo: "prospect.created", "stage.changed"...). Ficam como string no banco — é uma fila de
/// tópicos aberta, não um enum fechado — mas com constante aqui pra não espalhar texto solto
/// pelos handlers.
/// </summary>
public static class IntegrationEventTypes
{
    public const string WhatsAppMessageSendRequested = "whatsapp.message.send_requested";
}
