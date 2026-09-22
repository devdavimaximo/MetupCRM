using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Domain.Conversations;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Conversations.Commands.MarkConversationRead;

/// <summary>
/// Upsert do cursor de leitura do usuário atual — idempotente (repetir não quebra nada). "Marcar
/// como não lida" (item 18 do plano) é um caso separado: apaga o registro, ver
/// <c>MarkConversationUnread</c> não existe ainda; esta onda só cobre o upsert de leitura.
/// </summary>
public class MarkConversationReadCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock) : IRequestHandler<MarkConversationReadCommand>
{
    public async Task Handle(MarkConversationReadCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        var conversationExists = await context.Conversations
            .AnyAsync(c => c.Id == request.ConversationId && c.OrganizationId == organizationId, cancellationToken);
        if (!conversationExists)
        {
            throw new NotFoundException("Conversa");
        }

        var clock = await organizationClock.SnapshotAsync(cancellationToken);

        var read = await context.ConversationReads
            .FirstOrDefaultAsync(r => r.ConversationId == request.ConversationId && r.UserId == userId, cancellationToken);

        if (read is null)
        {
            context.ConversationReads.Add(new ConversationRead
            {
                OrganizationId = organizationId,
                ConversationId = request.ConversationId,
                UserId = userId,
                LastReadAt = clock.UtcNow,
            });
        }
        else
        {
            read.LastReadAt = clock.UtcNow;
        }

        await context.SaveChangesAsync(cancellationToken);
    }
}
