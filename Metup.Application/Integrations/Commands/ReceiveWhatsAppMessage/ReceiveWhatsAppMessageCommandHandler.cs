using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Extensions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Conversations.Common;
using Metup.Domain.Conversations;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Integrations.Commands.ReceiveWhatsAppMessage;

/// <summary>
/// Ingestão de mensagem recebida via WhatsApp (n8n → CRM). O código valida tudo — nunca confia
/// cegamente no payload da automação (regra 5 do CLAUDE.md): o contato precisa já existir na
/// organização do token, e o ExternalMessageId garante idempotência se o n8n reenviar.
/// </summary>
public class ReceiveWhatsAppMessageCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<ReceiveWhatsAppMessageCommand, MessageDto>
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

        var conversation = await context.Conversations
            .Where(c => c.OrganizationId == organizationId && c.ContactId == contact.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (conversation is null)
        {
            conversation = Conversation.Create(organizationId, contact.Id);
            context.Conversations.Add(conversation);
        }

        var (dealId, dealStage) = await DealSnapshot.ResolveForContactAsync(
            context, organizationId, contact.Id, cancellationToken);

        var occurredAt = request.OccurredAt ?? DateTime.UtcNow;

        var message = Message.ReceiveInbound(
            organizationId, conversation.Id, request.Body, request.ExternalMessageId, dealId, dealStage, occurredAt);
        context.Messages.Add(message);

        conversation.LastMessageAt = occurredAt;

        await context.SaveChangesAsync(cancellationToken);

        return await context.Messages
            .AsNoTracking()
            .Where(m => m.Id == message.Id)
            .ToMessageDto(context)
            .FirstAsync(cancellationToken);
    }
}
