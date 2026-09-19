using System.Text.Json;
using Metup.Application.Activities.Common;
using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Tasks.Common;
using Metup.Domain.Activities;
using Metup.Domain.Common.Exceptions;
using Metup.Domain.Integrations;
using Metup.Domain.Tasks;
using Metup.Application.Common.Realtime;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Activities.Commands.LogActivity;

public class LogActivityCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock,
    IPublisher publisher) : IRequestHandler<LogActivityCommand, LogActivityResultDto>
{
    public async Task<LogActivityResultDto> Handle(LogActivityCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        // Negócio e contato precisam existir DENTRO da organização do usuário — mesmo padrão
        // que CreateDealCommandHandler já usa (404 genérico, sem vazar dado de outra org).
        var dealOwnerUserId = await context.Deals
            .Where(d => d.Id == request.DealId && d.OrganizationId == organizationId)
            .Select(d => (Guid?)d.OwnerUserId)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Negócio");

        if (request.ContactId is { } contactId)
        {
            var contactExists = await context.Contacts
                .AnyAsync(c => c.Id == contactId && c.OrganizationId == organizationId, cancellationToken);
            if (!contactExists)
            {
                throw new NotFoundException("Contato");
            }
        }

        var completedTask = request.CompletesTaskId is { } completesTaskId
            ? await CompleteOriginTaskAsync(completesTaskId, request.DealId, cancellationToken)
            : null;

        var activity = Activity.Log(
            organizationId,
            request.DealId,
            request.ContactId,
            request.Type,
            request.Outcome,
            request.Note,
            userId,
            request.OccurredAt ?? DateTime.UtcNow);

        context.Activities.Add(activity);

        // Activity e TaskItem são agregados independentes (sem FK entre si) — a "operação coesa"
        // fica na coordenação do handler, cada um com seus próprios invariantes de domínio, no
        // mesmo espírito de CreateDealCommandHandler orquestrar Deal.Create + StageChanges.
        TaskItem? task = null;
        if (request.NextActionType is { } nextActionType && request.NextActionDueDate is { } nextActionDueDate)
        {
            task = TaskItem.Create(
                organizationId,
                request.DealId,
                nextActionType,
                nextActionDueDate,
                userId,
                request.NextActionNote);

            context.Tasks.Add(task);
        }

        var payload = JsonSerializer.Serialize(new
        {
            activityId = activity.Id,
            dealId = activity.DealId,
            type = activity.Type.ToString(),
            outcome = activity.Outcome?.ToString(),
            authorUserId = activity.AuthorUserId,
            occurredAt = activity.OccurredAt,
        });

        context.IntegrationEvents.Add(
            IntegrationEvent.Create(organizationId, IntegrationEventTypes.ActivityLogged, payload));

        await context.SaveChangesAsync(cancellationToken);
        await publisher.Publish(new ActivityLoggedNotification(organizationId, activity.DealId, dealOwnerUserId), cancellationToken);
        if (completedTask is not null)
        {
            await publisher.Publish(new TaskCompletedNotification(organizationId, completedTask.DealId, completedTask.OwnerUserId), cancellationToken);
        }

        var activityDto = await context.Activities
            .AsNoTracking()
            .Where(a => a.Id == activity.Id)
            .ToActivityDto(context)
            .FirstAsync(cancellationToken);

        TaskDto? taskDto = task is null
            ? null
            : await context.Tasks
                .AsNoTracking()
                .Where(t => t.Id == task.Id)
                .ToTaskDto(context)
                .FirstAsync(cancellationToken);

        return new LogActivityResultDto(activityDto, taskDto);
    }

    /// <summary>
    /// A tarefa de origem passa pela mesma permissão das ações por linha (404/403), precisa ser do
    /// negócio da atividade e estar pendente (o domínio recusa com 409). Só é gravada no
    /// <c>SaveChanges</c> da atividade — tudo ou nada.
    /// </summary>
    private async Task<TaskItem> CompleteOriginTaskAsync(Guid taskId, Guid dealId, CancellationToken cancellationToken)
    {
        var task = await context.LoadForActionAsync(currentUserService, taskId, cancellationToken);

        if (task.DealId != dealId)
        {
            throw new DomainRuleException("A tarefa não pertence a este negócio.");
        }

        var clock = await organizationClock.SnapshotAsync(cancellationToken);
        task.Complete(clock.UtcNow);

        return task;
    }
}
