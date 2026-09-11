using Metup.Application.Activities.Common;
using Metup.Domain.Activities;
using MediatR;

namespace Metup.Application.Activities.Commands.LogActivity;

/// <remarks>
/// Sem OrganizationId/AuthorUserId: escopo e autor vêm do usuário logado, nunca do client.
/// Quando NextActionType e NextActionDueDate vêm informados, a tarefa de próxima ação nasce
/// junto com a atividade — "registrar é rápido" (seção 3 do CLAUDE.md), sem um segundo passo.
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
    string? NextActionNote) : IRequest<LogActivityResultDto>;
