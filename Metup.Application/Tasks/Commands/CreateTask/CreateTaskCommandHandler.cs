using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Tasks.Common;
using Metup.Domain.Common.Exceptions;
using Metup.Domain.Deals;
using Metup.Domain.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Tasks.Commands.CreateTask;

/// <summary>
/// Cria a próxima ação sobre um negócio. Pela ingestão (n8n → CRM, V2) a cadência "quando X então
/// Y" mora inteiramente no n8n: o código só valida e persiste, nenhuma regra de cadência entra aqui.
/// Sem ExternalRequestId de dedupe — ver nota em TaskIngestionController. Nenhum evento de saída é
/// publicado (<c>task.*</c> está fora de escopo).
/// </summary>
public class CreateTaskCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<CreateTaskCommand, TaskDto>
{
    public async Task<TaskDto> Handle(CreateTaskCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        // Negócio precisa existir DENTRO da organização — mesmo padrão de LogActivityCommandHandler/
        // CreateDealCommandHandler (404 genérico, sem vazar dado de outra org).
        var deal = await context.Deals
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == request.DealId && d.OrganizationId == organizationId, cancellationToken)
            ?? throw new NotFoundException("Negócio");

        if (deal.Status != DealStatus.Aberto)
        {
            throw new DomainRuleException("O negócio já está fechado — não é possível agendar tarefa nele.");
        }

        var ownerUserId = await ResolveOwnerAsync(request, deal, organizationId, cancellationToken);

        var task = TaskItem.Create(
            organizationId,
            request.DealId,
            request.Type,
            request.DueDate,
            ownerUserId,
            request.Note);

        context.Tasks.Add(task);

        await context.SaveChangesAsync(cancellationToken);

        return await context.Tasks
            .AsNoTracking()
            .Where(t => t.Id == task.Id)
            .ToTaskDto(context)
            .FirstAsync(cancellationToken);
    }

    /// <summary>
    /// Service token (sem usuário): o dono herda o responsável atual do negócio. Usuário logado: ele
    /// mesmo, ou quem ele pediu se o papel permitir (<c>ResolveTaskOwnerScope</c>) — e o destino
    /// precisa ser da mesma organização.
    /// </summary>
    private async Task<Guid> ResolveOwnerAsync(
        CreateTaskCommand request,
        Deal deal,
        Guid organizationId,
        CancellationToken cancellationToken)
    {
        if (currentUserService.UserId is null)
        {
            return deal.OwnerUserId;
        }

        var ownerUserId = currentUserService.ResolveTaskOwnerScope(request.OwnerUserId).OwnerUserId!.Value;

        var ownerBelongsToOrganization = await context.Users
            .AnyAsync(u => u.Id == ownerUserId && u.OrganizationId == organizationId, cancellationToken);

        return ownerBelongsToOrganization ? ownerUserId : throw new NotFoundException("Responsável");
    }
}
