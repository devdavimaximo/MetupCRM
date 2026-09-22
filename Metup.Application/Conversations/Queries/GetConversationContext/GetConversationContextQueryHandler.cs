using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Conversations.Common;
using Metup.Domain.Conversations;
using Metup.Domain.Deals;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Conversations.Queries.GetConversationContext;

public class GetConversationContextQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetConversationContextQuery, ConversationContextDto>
{
    public async Task<ConversationContextDto> Handle(GetConversationContextQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var conversation = await context.Conversations
            .AsNoTracking()
            .Where(c => c.Id == request.ConversationId && c.OrganizationId == organizationId)
            .Select(c => new { c.Id, c.ContactId, c.Channel, c.Status, c.AutomationEnabled })
            .FirstOrDefaultAsync(cancellationToken);
        if (conversation is null)
        {
            throw new NotFoundException("Conversa");
        }

        var contact = await context.Contacts
            .AsNoTracking()
            .Where(c => c.Id == conversation.ContactId)
            .Select(c => new { c.Id, c.Name, c.Role, c.Phone, c.WhatsApp, c.Email, c.CompanyId })
            .FirstAsync(cancellationToken);

        var company = await context.Companies
            .AsNoTracking()
            .Where(co => co.Id == contact.CompanyId)
            .Select(co => new { co.Name, co.Cnpj, co.Website, co.Segment, co.City })
            .FirstAsync(cancellationToken);

        var deal = await context.Deals
            .AsNoTracking()
            .Where(d => d.OrganizationId == organizationId && d.ContactId == contact.Id)
            .OrderBy(d => d.Status == DealStatus.Aberto ? 0 : 1)
            .ThenByDescending(d => d.CreatedAt)
            .Select(d => new { d.Id, d.Stage, d.Status, d.Ticket, d.Amount, d.OwnerUserId })
            .FirstOrDefaultAsync(cancellationToken);

        var dealOwnerUserName = deal is null
            ? null
            : await context.Users
                .AsNoTracking()
                .Where(u => u.Id == deal.OwnerUserId)
                .Select(u => u.Name)
                .FirstOrDefaultAsync(cancellationToken);

        var tags = await context.ConversationTags
            .Where(t => t.ConversationId == conversation.Id)
            .Join(context.ConversationTagOptions, t => t.TagOptionId, o => o.Id, (t, o) => o.Name)
            .OrderBy(n => n)
            .ToListAsync(cancellationToken);

        var summary = await BuildSummaryAsync(conversation.Id, cancellationToken);

        return new ConversationContextDto(
            contact.Id,
            contact.Name,
            contact.Role,
            contact.Phone,
            contact.WhatsApp,
            contact.Email,
            contact.CompanyId,
            company.Name,
            deal?.Id,
            deal?.Stage,
            deal?.Status,
            deal?.Ticket,
            deal?.Amount,
            conversation.Channel,
            conversation.Status,
            conversation.AutomationEnabled,
            tags,
            company.Cnpj,
            company.Website,
            company.Segment,
            company.City,
            dealOwnerUserName,
            summary);
    }

    /// <summary>
    /// Tempo médio, em minutos, entre uma mensagem inbound e a primeira outbound que vem depois
    /// dela na mesma conversa — pares sem outbound seguinte não entram na média. Uma consulta às
    /// mensagens em ordem, calculada sob demanda (não é campo persistido).
    /// </summary>
    private async Task<ConversationSummaryDto> BuildSummaryAsync(Guid conversationId, CancellationToken cancellationToken)
    {
        var messages = await context.Messages
            .AsNoTracking()
            .Where(m => m.ConversationId == conversationId)
            .OrderBy(m => m.OccurredAt)
            .Select(m => new { m.Direction, m.OccurredAt })
            .ToListAsync(cancellationToken);

        if (messages.Count == 0)
        {
            return new ConversationSummaryDto(0, null, null);
        }

        // Cada inbound pareia com a próxima outbound que a segue — várias inbound seguidas antes
        // de uma resposta viram vários pares para a mesma outbound (mede a espera de cada mensagem).
        var responseTimes = new List<double>();
        var pendingInbounds = new List<DateTime>();

        foreach (var message in messages)
        {
            if (message.Direction == MessageDirection.Inbound)
            {
                pendingInbounds.Add(message.OccurredAt);
            }
            else if (pendingInbounds.Count > 0)
            {
                responseTimes.AddRange(pendingInbounds.Select(inboundAt => (message.OccurredAt - inboundAt).TotalMinutes));
                pendingInbounds.Clear();
            }
        }

        return new ConversationSummaryDto(
            messages.Count,
            responseTimes.Count == 0 ? null : responseTimes.Average(),
            messages[^1].OccurredAt);
    }
}
