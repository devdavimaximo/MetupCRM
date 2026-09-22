using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Conversations.Commands.SetConversationAutomation;

/// <summary>
/// Liga/desliga o interruptor que o n8n vai consultar na V2 — nenhuma automação de fato reage a
/// ele ainda (item 8/21 do plano C1, costura pronta sem implementar a cadência).
/// </summary>
public class SetConversationAutomationCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<SetConversationAutomationCommand>
{
    public async Task Handle(SetConversationAutomationCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var conversation = await context.Conversations
            .Where(c => c.Id == request.ConversationId && c.OrganizationId == organizationId)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Conversa");

        if (request.Enabled)
        {
            conversation.EnableAutomation();
        }
        else
        {
            conversation.DisableAutomation();
        }

        await context.SaveChangesAsync(cancellationToken);
    }
}
