using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Tasks.Common;
using Metup.Domain.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Tasks.Commands.CreateTask;

/// <summary>
/// Ingestão de tarefa (n8n → CRM, V2 — a cadência "quando X então Y" mora inteiramente no n8n,
/// que reage a um evento e cria a próxima ação via API; seção 5 do CLAUDE.md). O código só
/// valida e persiste: nenhuma regra de cadência entra aqui. Sem ExternalRequestId de dedupe —
/// ver nota em TaskIngestionController sobre por que essa tarefa não tem um "id externo" natural.
/// </summary>
public class CreateTaskCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<CreateTaskCommand, TaskDto>
{
    public async Task<TaskDto> Handle(CreateTaskCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        // Negócio precisa existir DENTRO da organização do token — mesmo padrão que
        // LogActivityCommandHandler/CreateDealCommandHandler já usam (404 genérico, sem vazar
        // dado de outra org). O dono da tarefa herda o responsável atual do negócio: o token do
        // n8n carrega só organização, não um usuário que possa "assinar" a tarefa.
        var deal = await context.Deals
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == request.DealId && d.OrganizationId == organizationId, cancellationToken)
            ?? throw new NotFoundException("Negócio");

        var task = TaskItem.Create(
            organizationId,
            request.DealId,
            request.Type,
            request.DueDate,
            deal.OwnerUserId,
            request.Note);

        context.Tasks.Add(task);

        await context.SaveChangesAsync(cancellationToken);

        return await context.Tasks
            .AsNoTracking()
            .Where(t => t.Id == task.Id)
            .ToTaskDto(context)
            .FirstAsync(cancellationToken);
    }
}
