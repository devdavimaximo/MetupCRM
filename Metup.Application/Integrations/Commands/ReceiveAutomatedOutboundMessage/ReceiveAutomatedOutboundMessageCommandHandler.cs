using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Extensions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Realtime;
using Metup.Application.Conversations.Common;
using Metup.Domain.Conversations;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Integrations.Commands.ReceiveAutomatedOutboundMessage;

/// <summary>
/// Ingestão de mensagem outbound já enviada pela automação (n8n → CRM). Mesma resolução de contato
/// por telefone que o inbound já faz (regra 5 do CLAUDE.md: nunca cria contato/empresa aqui) e a
/// mesma idempotência por <c>ExternalMessageId</c>. Sem V2 rodando, este endpoint fica pronto e sem
/// uso — é a costura da regra 4.1, não a automação em si.
/// </summary>
public class ReceiveAutomatedOutboundMessageCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IPublisher publisher) : IRequestHandler<ReceiveAutomatedOutboundMessageCommand, MessageDto>
{
    public async Task<MessageDto> Handle(ReceiveAutomatedOutboundMessageCommand request, CancellationToken cancellationToken)
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

        var candidates = await context.Contacts
            .AsNoTracking()
            .Where(c => c.OrganizationId == organizationId && (c.WhatsApp != null || c.Phone != null))
            .Select(c => new { c.Id, c.WhatsApp, c.Phone })
            .ToListAsync(cancellationToken);

        var contact = candidates.FirstOrDefault(c =>
            c.WhatsApp.MatchesPhone(request.ToWhatsApp) || c.Phone.MatchesPhone(request.ToWhatsApp));
        if (contact is null)
        {
            throw new NotFoundException("Contato");
        }

        var conversation = await context.Conversations
            .Where(c => c.OrganizationId == organizationId && c.ContactId == contact.Id && c.Channel == ConversationChannel.WhatsApp)
            .FirstOrDefaultAsync(cancellationToken);

        if (conversation is null)
        {
            conversation = Conversation.Create(organizationId, contact.Id, ConversationChannel.WhatsApp);
            context.Conversations.Add(conversation);
        }
        else if (conversation.Status == ConversationStatus.Resolvida)
        {
            conversation.Reopen();
        }

        var (dealId, dealStage) = await DealSnapshot.ResolveForContactAsync(
            context, organizationId, contact.Id, cancellationToken);

        var occurredAt = request.OccurredAt ?? DateTime.UtcNow;

        var message = Message.ReceiveAutomatedOutbound(
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
        await publisher.Publish(new ConversationMessageSentNotification(organizationId, conversation.Id), cancellationToken);

        return await context.Messages
            .AsNoTracking()
            .Where(m => m.Id == message.Id)
            .ToMessageDto(context)
            .FirstAsync(cancellationToken);
    }
}
