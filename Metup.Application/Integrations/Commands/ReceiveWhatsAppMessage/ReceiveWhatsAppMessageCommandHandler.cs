using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Extensions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Realtime;
using Metup.Application.Conversations.Common;
using Metup.Domain.Conversations;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Integrations.Commands.ReceiveWhatsAppMessage;

/// <summary>
/// Ingestão de mensagem recebida via WhatsApp (n8n → CRM). O código valida tudo — nunca confia
/// cegamente no payload da automação (regra 5 do CLAUDE.md): o contato precisa já existir na
/// organização do token, e o ExternalMessageId garante idempotência se o n8n reenviar. A conversa é
/// resolvida primeiro por <see cref="ReceiveWhatsAppMessageCommand.ExternalConversationId"/> (id do
/// Chatwoot) quando vier; só cai para telefone quando não vier ou não achar (item 2 do plano C1).
/// </summary>
public class ReceiveWhatsAppMessageCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IPublisher publisher) : IRequestHandler<ReceiveWhatsAppMessageCommand, MessageDto>
{
    public async Task<MessageDto> Handle(ReceiveWhatsAppMessageCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        if (request.ExternalMessageId is { } externalMessageId)
        {
            var existingMessageId = await context.Messages
                .AsNoTracking()
                .Where(m => m.OrganizationId == organizationId && m.ExternalMessageId == externalMessageId)
                .Select(m => m.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (existingMessageId != Guid.Empty)
            {
                return await context.Messages
                    .AsNoTracking()
                    .Where(m => m.Id == existingMessageId)
                    .ToMessageDto(context)
                    .FirstAsync(cancellationToken);
            }
        }

        var conversation = string.IsNullOrWhiteSpace(request.ExternalConversationId)
            ? null
            : await context.Conversations
                .Where(c => c.OrganizationId == organizationId && c.ExternalId == request.ExternalConversationId)
                .FirstOrDefaultAsync(cancellationToken);

        Guid contactId;

        if (conversation is not null)
        {
            contactId = conversation.ContactId;
        }
        else
        {
            // Conjunto pequeno por organização em V1 — compara em memória pra tolerar formatação/DDI
            // diferentes (PhoneExtensions.MatchesPhone), sem tentar traduzir normalização pro SQL.
            // Nunca cria contato/empresa a partir de mensagem inbound — isso seria ingestão de lead
            // nova, fora do pedido desta fatia.
            var candidates = await context.Contacts
                .AsNoTracking()
                .Where(c => c.OrganizationId == organizationId && (c.WhatsApp != null || c.Phone != null))
                .Select(c => new { c.Id, c.WhatsApp, c.Phone })
                .ToListAsync(cancellationToken);

            var contact = candidates.FirstOrDefault(c =>
                c.WhatsApp.MatchesPhone(request.FromWhatsApp) || c.Phone.MatchesPhone(request.FromWhatsApp));
            if (contact is null)
            {
                throw new NotFoundException("Contato");
            }

            contactId = contact.Id;

            conversation = await context.Conversations
                .Where(c => c.OrganizationId == organizationId && c.ContactId == contactId && c.Channel == ConversationChannel.WhatsApp)
                .FirstOrDefaultAsync(cancellationToken);

            if (conversation is null)
            {
                conversation = Conversation.Create(organizationId, contactId, ConversationChannel.WhatsApp, request.ExternalConversationId);
                context.Conversations.Add(conversation);
            }
            else if (conversation.ExternalId is null && request.ExternalConversationId is not null)
            {
                conversation.ExternalId = request.ExternalConversationId;
            }
        }

        if (conversation.Status == ConversationStatus.Resolvida)
        {
            conversation.Reopen();
        }

        var (dealId, dealStage) = await DealSnapshot.ResolveForContactAsync(
            context, organizationId, contactId, cancellationToken);

        var occurredAt = request.OccurredAt ?? DateTime.UtcNow;

        var message = Message.ReceiveInbound(
            organizationId, conversation.Id, request.Body, request.ExternalMessageId, dealId, dealStage, occurredAt);
        context.Messages.Add(message);

        if (request.Attachments is { Count: > 0 } attachments)
        {
            foreach (var attachment in attachments)
            {
                context.MessageAttachments.Add(new MessageAttachment
                {
                    OrganizationId = organizationId,
                    MessageId = message.Id,
                    Kind = attachment.Kind,
                    Url = attachment.Url,
                    FileName = attachment.FileName,
                    MimeType = attachment.MimeType,
                    SizeBytes = attachment.SizeBytes,
                });
            }
        }

        conversation.LastMessageAt = occurredAt;

        await context.SaveChangesAsync(cancellationToken);
        await publisher.Publish(new ConversationMessageReceivedNotification(organizationId, conversation.Id), cancellationToken);

        return await context.Messages
            .AsNoTracking()
            .Where(m => m.Id == message.Id)
            .ToMessageDto(context)
            .FirstAsync(cancellationToken);
    }
}
