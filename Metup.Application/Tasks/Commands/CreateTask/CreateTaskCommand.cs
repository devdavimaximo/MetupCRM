using Metup.Application.Tasks.Common;
using Metup.Domain.Activities;
using MediatR;

namespace Metup.Application.Tasks.Commands.CreateTask;

/// <remarks>
/// Sem OrganizationId nem OwnerUserId: o escopo vem do service token do n8n (organização), e o
/// dono da tarefa é sempre o responsável atual do negócio — o token não carrega usuário.
/// </remarks>
public record CreateTaskCommand(
    Guid DealId,
    ActivityType Type,
    DateTime DueDate,
    string? Note) : IRequest<TaskDto>;
