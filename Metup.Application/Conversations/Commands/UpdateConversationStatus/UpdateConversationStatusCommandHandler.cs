using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Realtime;
using Metup.Domain.Conversations;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Conversations.Commands.UpdateConversationStatus;

/// <summary>
/// Menu "⋮" da conversa: qualquer status pode ir para qualquer outro manualmente, sem validação
/// de transição complexa nesta fase (item 3 do plano C1).
/// </summary>
public class UpdateConversationStatusCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IPublisher publisher) : IRequestHandler<UpdateConversationStatusCommand>
{
    public async Task Handle(UpdateConversationStatusCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var conversation = await context.Conversations
            .Where(c => c.Id == request.ConversationId && c.OrganizationId == organizationId)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Conversa");

        switch (request.Status)
        {
            case ConversationStatus.Aberta:
                conversation.Reopen();
                break;
            case ConversationStatus.Pendente:
                conversation.MarkPending();
                break;
            case ConversationStatus.Resolvida:
                conversation.Resolve();
                break;
        }

        await context.SaveChangesAsync(cancellationToken);
        await publisher.Publish(new ConversationStatusChangedNotification(organizationId, conversation.Id), cancellationToken);
    }
}
