using System.Text.Json;
using Metup.Application.Activities.Common;
using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Tasks.Common;
using Metup.Domain.Activities;
using Metup.Domain.Integrations;
using Metup.Domain.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Activities.Commands.LogActivity;

public class LogActivityCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<LogActivityCommand, LogActivityResultDto>
{
    public async Task<LogActivityResultDto> Handle(LogActivityCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        // Negócio e contato precisam existir DENTRO da organização do usuário — mesmo padrão
        // que CreateDealCommandHandler já usa (404 genérico, sem vazar dado de outra org).
        var dealExists = await context.Deals
            .AnyAsync(d => d.Id == request.DealId && d.OrganizationId == organizationId, cancellationToken);
        if (!dealExists)
        {
            throw new NotFoundException("Negócio");
        }

        if (request.ContactId is { } contactId)
        {
            var contactExists = await context.Contacts
                .AnyAsync(c => c.Id == contactId && c.OrganizationId == organizationId, cancellationToken);
            if (!contactExists)
            {
                throw new NotFoundException("Contato");
            }
        }

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
}
