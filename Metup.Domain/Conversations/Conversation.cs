using Metup.Domain.Common;

namespace Metup.Domain.Conversations;

/// <summary>
/// Thread com um Contact num canal — um contato pode ter uma conversa por canal (hoje só
/// WhatsApp; o índice único vira contato+canal quando outro canal existir no Chatwoot). Nasce da
/// primeira mensagem inbound entregue pelo n8n; o dado e a inbox são do código, a entrega de fato
/// é do n8n (seção 5 do CLAUDE.md).
/// </summary>
public class Conversation : BaseEntity
{
    public Guid ContactId { get; set; }

    public ConversationChannel Channel { get; private set; }

    /// <summary>Id da conversa no provedor externo (Chatwoot) — a ingestão resolve por ele primeiro, antes do telefone.</summary>
    public string? ExternalId { get; set; }

    public ConversationStatus Status { get; private set; } = ConversationStatus.Aberta;

    /// <summary>
    /// Liga/desliga pela tela (item 21 do plano); quem decide o que/quando responder é o n8n, na
    /// V2, que ainda não existe — aqui só a costura fica pronta (regra 4.1 do CLAUDE.md).
    /// </summary>
    public bool AutomationEnabled { get; private set; }

    public DateTime? LastMessageAt { get; set; }

    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

    public static Conversation Create(Guid organizationId, Guid contactId, ConversationChannel channel, string? externalId = null) =>
        new()
        {
            OrganizationId = organizationId,
            ContactId = contactId,
            Channel = channel,
            ExternalId = externalId,
        };

    public void MarkPending() => Status = ConversationStatus.Pendente;

    public void Resolve() => Status = ConversationStatus.Resolvida;

    public void Reopen() => Status = ConversationStatus.Aberta;

    public void EnableAutomation() => AutomationEnabled = true;

    public void DisableAutomation() => AutomationEnabled = false;
}
