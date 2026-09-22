using MediatR;

namespace Metup.Application.Common.Realtime;

/// <summary>
/// Aviso in-process de que algo mudou e as telas abertas devem se atualizar. Publicado pelos
/// handlers de comando <b>depois</b> do <c>SaveChangesAsync</c>. Leva só o necessário para o front
/// decidir o que refazer (tipo, negócio, responsável): as telas refazem as próprias queries, que
/// aplicam o escopo de quem está vendo.
///
/// Não é evento de integração: o n8n continua ouvindo só a fila <c>IntegrationEvent</c> (seção 5 do
/// CLAUDE.md). Se o tempo real cair, nada se perde, e as telas revalidam ao reconectar.
/// </summary>
public interface IRealtimeNotification : INotification
{
    /// <summary>Nome do evento no hub (ex.: <c>deal.stageChanged</c>).</summary>
    string Type { get; }

    Guid OrganizationId { get; }

    Guid? DealId { get; }

    /// <summary>Responsável pelo negócio (ou pela tarefa).</summary>
    Guid? OwnerUserId { get; }

    /// <summary>Verdadeiro quando só o responsável precisa saber (ex.: tarefa concluída).</summary>
    bool UserScoped { get; }
}

/// <summary>
/// Implementada só pelos avisos de conversa — carregam <see cref="ConversationId"/> além do que
/// <see cref="IRealtimeNotification"/> já exige, sem forçar os avisos de negócio existentes a
/// declarar um campo que não têm.
/// </summary>
public interface IConversationRealtimeNotification : IRealtimeNotification
{
    Guid ConversationId { get; }
}

public static class RealtimeEventTypes
{
    public const string DealCreated = "deal.created";
    public const string DealStageChanged = "deal.stageChanged";
    public const string DealClosed = "deal.closed";
    public const string ActivityLogged = "activity.logged";
    public const string TaskCompleted = "task.completed";
    public const string ConversationMessageReceived = "conversation.messageReceived";
    public const string ConversationMessageSent = "conversation.messageSent";
    public const string ConversationStatusChanged = "conversation.statusChanged";
    public const string ConversationFavorited = "conversation.favorited";
}

public sealed record DealCreatedNotification(Guid OrganizationId, Guid DealId, Guid OwnerUserId) : IRealtimeNotification
{
    public string Type => RealtimeEventTypes.DealCreated;
    Guid? IRealtimeNotification.DealId => DealId;
    Guid? IRealtimeNotification.OwnerUserId => OwnerUserId;
    public bool UserScoped => false;
}

public sealed record DealStageChangedNotification(Guid OrganizationId, Guid DealId, Guid OwnerUserId) : IRealtimeNotification
{
    public string Type => RealtimeEventTypes.DealStageChanged;
    Guid? IRealtimeNotification.DealId => DealId;
    Guid? IRealtimeNotification.OwnerUserId => OwnerUserId;
    public bool UserScoped => false;
}

public sealed record DealClosedNotification(Guid OrganizationId, Guid DealId, Guid OwnerUserId) : IRealtimeNotification
{
    public string Type => RealtimeEventTypes.DealClosed;
    Guid? IRealtimeNotification.DealId => DealId;
    Guid? IRealtimeNotification.OwnerUserId => OwnerUserId;
    public bool UserScoped => false;
}

public sealed record ActivityLoggedNotification(Guid OrganizationId, Guid DealId, Guid OwnerUserId) : IRealtimeNotification
{
    public string Type => RealtimeEventTypes.ActivityLogged;
    Guid? IRealtimeNotification.DealId => DealId;
    Guid? IRealtimeNotification.OwnerUserId => OwnerUserId;
    public bool UserScoped => false;
}

/// <summary>Vai só para o grupo do responsável pela tarefa: a fila de tarefas é pessoal.</summary>
public sealed record TaskCompletedNotification(Guid OrganizationId, Guid DealId, Guid OwnerUserId) : IRealtimeNotification
{
    public string Type => RealtimeEventTypes.TaskCompleted;
    Guid? IRealtimeNotification.DealId => DealId;
    Guid? IRealtimeNotification.OwnerUserId => OwnerUserId;
    public bool UserScoped => true;
}

/// <summary>Mensagem inbound nova — vai para o grupo da organização (qualquer SDR pode estar olhando a Inbox).</summary>
public sealed record ConversationMessageReceivedNotification(Guid OrganizationId, Guid ConversationId) : IConversationRealtimeNotification
{
    public string Type => RealtimeEventTypes.ConversationMessageReceived;
    Guid? IRealtimeNotification.DealId => null;
    Guid? IRealtimeNotification.OwnerUserId => null;
    public bool UserScoped => false;
}

/// <summary>SDR respondeu pela inbox — sincroniza entre abas/SDRs, mesmo grupo de organização.</summary>
public sealed record ConversationMessageSentNotification(Guid OrganizationId, Guid ConversationId) : IConversationRealtimeNotification
{
    public string Type => RealtimeEventTypes.ConversationMessageSent;
    Guid? IRealtimeNotification.DealId => null;
    Guid? IRealtimeNotification.OwnerUserId => null;
    public bool UserScoped => false;
}

public sealed record ConversationStatusChangedNotification(Guid OrganizationId, Guid ConversationId) : IConversationRealtimeNotification
{
    public string Type => RealtimeEventTypes.ConversationStatusChanged;
    Guid? IRealtimeNotification.DealId => null;
    Guid? IRealtimeNotification.OwnerUserId => null;
    public bool UserScoped => false;
}

/// <summary>Favoritar é preferência pessoal — vai só para o grupo do usuário que favoritou.</summary>
public sealed record ConversationFavoritedNotification(Guid OrganizationId, Guid ConversationId, Guid UserId) : IConversationRealtimeNotification
{
    public string Type => RealtimeEventTypes.ConversationFavorited;
    Guid? IRealtimeNotification.DealId => null;
    Guid? IRealtimeNotification.OwnerUserId => UserId;
    public bool UserScoped => true;
}
