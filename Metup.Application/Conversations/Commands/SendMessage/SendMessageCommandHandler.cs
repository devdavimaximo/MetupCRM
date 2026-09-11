using System.Text.Json;
using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Conversations.Common;
using Metup.Domain.Conversations;
using Metup.Domain.Integrations;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Conversations.Commands.SendMessage;

/// <summary>
/// O SDR responde pela inbox: grava a mensagem outbound e enfileira um IntegrationEvent para
/// o n8n consumir e entregar de fato via WhatsApp. O código nunca fala com a API do WhatsApp
/// diretamente (regra 4.5/5 do CLAUDE.md) — só registra a intenção.
/// </summary>
public class SendMessageCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<SendMessageCommand, MessageDto>
{
    public async Task<MessageDto> Handle(SendMessageCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        var conversation = await context.Conversations
            .Where(c => c.Id == request.ConversationId && c.OrganizationId == organizationId)
            .FirstOrDefaultAsync(cancellationToken);
        if (conversation is null)
        {
            throw new NotFoundException("Conversa");
        }

        var contact = await context.Contacts
            .AsNoTracking()
            .Where(c => c.Id == conversation.ContactId)
            .Select(c => new { c.WhatsApp, c.Phone })
            .FirstAsync(cancellationToken);

        var (dealId, dealStage) = await DealSnapshot.ResolveForContactAsync(
            context, organizationId, conversation.ContactId, cancellationToken);

        var now = DateTime.UtcNow;

        var message = Message.SendOutbound(organizationId, conversation.Id, request.Body, userId, dealId, dealStage, now);
        context.Messages.Add(message);

        conversation.LastMessageAt = now;

        var payload = JsonSerializer.Serialize(new
        {
            conversationId = conversation.Id,
            messageId = message.Id,
            contactId = conversation.ContactId,
            toWhatsApp = contact.WhatsApp ?? contact.Phone,
            body = message.Body,
        });

        context.IntegrationEvents.Add(
            IntegrationEvent.Create(organizationId, IntegrationEventTypes.WhatsAppMessageSendRequested, payload));

        await context.SaveChangesAsync(cancellationToken);

        return await context.Messages
            .AsNoTracking()
            .Where(m => m.Id == message.Id)
            .ToMessageDto(context)
            .FirstAsync(cancellationToken);
    }
}
