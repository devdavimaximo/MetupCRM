using Metup.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Conversations.Commands.MarkConversationUnread;

/// <summary>
/// Idempotente: apaga o cursor de leitura do usuário atual para a conversa — sem registro, "não
/// lida" já vale (mesmo padrão de <c>UnfavoriteConversationCommandHandler</c>).
/// </summary>
public class MarkConversationUnreadCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<MarkConversationUnreadCommand>
{
    public async Task Handle(MarkConversationUnreadCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        var read = await context.ConversationReads
            .Where(r => r.ConversationId == request.ConversationId
                && r.UserId == userId
                && r.OrganizationId == organizationId)
            .FirstOrDefaultAsync(cancellationToken);

        if (read is not null)
        {
            context.ConversationReads.Remove(read);
            await context.SaveChangesAsync(cancellationToken);
        }
    }
}
