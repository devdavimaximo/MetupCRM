using Metup.Domain.Activities;

namespace Metup.Application.Notifications.Common;

public enum NotificationKind
{
    /// <summary>Tarefa pendente do usuário que vence nos próximos 60 minutos.</summary>
    TaskDueSoon,

    /// <summary>Tarefa pendente do usuário com prazo já vencido.</summary>
    TaskOverdue,

    /// <summary>Negócio aberto que passou hoje (no fuso da organização) do limite de parado.</summary>
    DealStalledToday,

    /// <summary>Conversa cuja última mensagem é do cliente e está sem resposta há mais de 30 minutos.</summary>
    ConversationAwaitingReply,
}

public enum NotificationSeverity
{
    Info,
    Warning,
    Critical,
}

/// <summary>
/// Uma notificação derivada: nada disso é gravado, tudo sai do estado atual de tarefas, negócios e
/// conversas. <c>OccurredAt</c> é o instante em que a notificação passou a valer (a tarefa entrou na
/// janela de 60 min, venceu, o negócio cruzou o limite, a conversa completou 30 min sem resposta);
/// o front compara com a última abertura do sino para contar as não lidas. <c>DueAt</c> é o prazo da
/// tarefa ou o instante da última mensagem, para o texto relativo. <c>Title</c> é o nome da empresa
/// (ou do contato, na conversa); a frase em pt-BR é montada no front a partir de <c>Kind</c>.
/// </summary>
public record NotificationDto(
    string Id,
    NotificationKind Kind,
    NotificationSeverity Severity,
    DateTime OccurredAt,
    DateTime? DueAt,
    string Title,
    Guid? DealId,
    Guid? TaskId,
    Guid? ConversationId,
    ActivityType? TaskType,
    int? StalledDealDays);
