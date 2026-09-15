using System.Text.Json;
using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Extensions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Deals.Common;
using Metup.Domain.Activities;
using Metup.Domain.Companies;
using Metup.Domain.Contacts;
using Metup.Domain.Deals;
using Metup.Domain.Integrations;
using Metup.Application.Common.Realtime;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Integrations.Commands.ReceiveMetaAdsLead;

/// <summary>
/// Ingestão de lead do Meta Ads (n8n → CRM, V4 — captação em si é do n8n; o código só valida e
/// persiste, regra 5 do CLAUDE.md). Diferente da ingestão de mensagem de WhatsApp, aqui a empresa
/// e o contato NÃO existem ainda — é justamente ingestão de lead novo, então cria os dois. Casar
/// o lead com uma empresa já cadastrada exigiria correspondência aproximada por nome sem chave
/// confiável nos dados do formulário do Meta; fora do escopo desta primeira fatia (o SDR funde
/// duplicatas manualmente se precisar).
/// </summary>
public class ReceiveMetaAdsLeadCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IPublisher publisher) : IRequestHandler<ReceiveMetaAdsLeadCommand, DealDto>
{
    public async Task<DealDto> Handle(ReceiveMetaAdsLeadCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var existingDealId = await context.Deals
            .AsNoTracking()
            .Where(d => d.OrganizationId == organizationId && d.ExternalLeadId == request.ExternalLeadId)
            .Select(d => d.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (existingDealId != Guid.Empty)
        {
            return await context.Deals
                .AsNoTracking()
                .Where(d => d.Id == existingDealId)
                .ToDealDto(context)
                .FirstAsync(cancellationToken);
        }

        // O responsável precisa existir DENTRO da organização do token — mesmo padrão que
        // CreateDealCommandHandler já usa. O token do n8n carrega só organização, nunca usuário,
        // então quem recebe o lead vem sempre do payload (a regra de distribuição é do n8n).
        var ownerExists = await context.Users
            .AnyAsync(u => u.Id == request.OwnerUserId && u.OrganizationId == organizationId, cancellationToken);
        if (!ownerExists)
        {
            throw new NotFoundException("Responsável");
        }

        var nowUtc = DateTime.UtcNow;

        var company = new Company
        {
            OrganizationId = organizationId,
            Name = request.CompanyName.NormalizeRequired(),
        };
        context.Companies.Add(company);

        var contact = new Contact
        {
            OrganizationId = organizationId,
            CompanyId = company.Id,
            Name = request.ContactName.NormalizeRequired(),
            Phone = request.Phone.NormalizeOptional(),
            Email = request.Email.NormalizeOptional(),
        };
        context.Contacts.Add(contact);

        var deal = Deal.Create(
            organizationId,
            company.Id,
            contact.Id,
            DealStage.Prospect,
            DealSource.MetaAds,
            request.OwnerUserId,
            request.Ticket,
            amount: null,
            createdByUserId: request.OwnerUserId,
            nowUtc,
            request.ExternalLeadId);
        context.Deals.Add(deal);

        if (request.Note.NormalizeOptional() is { } note)
        {
            context.Activities.Add(Activity.Log(
                organizationId,
                deal.Id,
                contact.Id,
                ActivityType.Note,
                outcome: null,
                note,
                request.OwnerUserId,
                nowUtc));
        }

        var payload = JsonSerializer.Serialize(new
        {
            dealId = deal.Id,
            companyId = deal.CompanyId,
            contactId = deal.ContactId,
            source = deal.Source.ToString(),
            stage = deal.Stage.ToString(),
            createdAt = deal.CreatedAt,
        });

        context.IntegrationEvents.Add(
            IntegrationEvent.Create(organizationId, IntegrationEventTypes.DealCreated, payload));

        await context.SaveChangesAsync(cancellationToken);
        await publisher.Publish(new DealCreatedNotification(organizationId, deal.Id, deal.OwnerUserId), cancellationToken);

        return await context.Deals
            .AsNoTracking()
            .Where(d => d.Id == deal.Id)
            .ToDealDto(context)
            .FirstAsync(cancellationToken);
    }
}
