using Metup.Application.Activities.Common;
using Metup.Domain.Activities;
using MediatR;

namespace Metup.Application.Activities.Commands.LogActivity;

/// <remarks>
/// Sem OrganizationId/AuthorUserId: escopo e autor vêm do usuário logado, nunca do client.
/// Quando NextActionType e NextActionDueDate vêm informados, a tarefa de próxima ação nasce
/// junto com a atividade — "registrar é rápido" (seção 3 do CLAUDE.md), sem um segundo passo.
/// <c>CompletesTaskId</c> (aditivo): conclui a tarefa de origem na mesma transação — a tela de
/// Tarefas registra a atividade "a partir da tarefa". Sem ele nada muda (dashboard, n8n).
/// </remarks>
public record LogActivityCommand(
    Guid DealId,
    Guid? ContactId,
    ActivityType Type,
    ActivityOutcome? Outcome,
    string? Note,
    DateTime? OccurredAt,
    ActivityType? NextActionType,
    DateTime? NextActionDueDate,
    string? NextActionNote,
    Guid? CompletesTaskId = null) : IRequest<LogActivityResultDto>;
