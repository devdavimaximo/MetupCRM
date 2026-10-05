namespace Metup.Domain.LeadFinder;

/// <summary>Gravado como texto (nome do enum) — renomear um membro é migration.</summary>
public enum LeadSearchStatus
{
    /// <summary>Pedida pelo CRM, aguardando a automação começar.</summary>
    Requested,

    /// <summary>A automação já começou a entregar (ou avisou que começou).</summary>
    Running,

    Completed,

    Failed,

    Cancelled,
}

/// <summary>Onde a busca nasceu.</summary>
public enum LeadSearchOrigin
{
    /// <summary>O usuário pediu pela tela do CRM.</summary>
    Crm,

    /// <summary>Disparada direto na automação (ex.: chat do agente no n8n).</summary>
    Automation,
}
