using System.Globalization;
using System.Text.Json;
using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Application.Common.Realtime;
using Metup.Domain.Activities;
using Metup.Domain.Companies;
using Metup.Domain.Deals;
using Metup.Domain.Integrations;
using Metup.Domain.LeadFinder;
using Metup.Domain.Tasks;
using Metup.Domain.Users;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.LeadFinder.Commands.ImportFoundLeads;

/// <summary>
/// Leva leads triados para o funil: cada um vira empresa + negócio em <see cref="DealStage.Prospect"/>
/// com origem <see cref="DealSource.LeadFinder"/> (o nascimento grava o StageChange, regra 4.2) e,
/// se pedido, uma ligação para hoje — o lead entra direto na fila do SDR (seção 3).
///
/// Lead cujo telefone já pertencia a uma empresa cadastrada reaproveita a empresa; se ela já tem
/// negócio aberto, o lead só é ligado a ele (sem negócio duplicado no funil). Tudo numa transação:
/// ou o lote inteiro entra, ou nada.
/// </summary>
public class ImportFoundLeadsCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock,
    IPublisher publisher) : IRequestHandler<ImportFoundLeadsCommand, ImportFoundLeadsResult>
{
    private const int CompanyNameMaxLength = 200;
    private const int CompanySegmentMaxLength = 120;
    private const int CompanyCityMaxLength = 120;
    private const int CompanyInstagramMaxLength = 120;
    private const int CompanyPhoneMaxLength = 40;
    private const int CompanyWebsiteMaxLength = 200;
    private const int TaskNoteMaxLength = 500;

    /// <summary>Ligação marcada para o fim da tarde local: entra no "hoje" sem já nascer atrasada.</summary>
    private static readonly TimeSpan CallTimeOfDay = TimeSpan.FromHours(18);

    public async Task<ImportFoundLeadsResult> Handle(ImportFoundLeadsCommand request, CancellationToken cancellationToken)
    {
        currentUserService.RequirePermission(Permission.LeadFinderView);
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        // Mesma regra das tarefas: pôr outra pessoa como responsável exige alcance da equipe (403 se não).
        var ownerUserId = currentUserService.ResolveTaskOwnerScope(request.OwnerUserId).OwnerUserId!.Value;
        var ownerIsActiveMember = await context.Users
            .AnyAsync(u => u.Id == ownerUserId && u.OrganizationId == organizationId && u.IsActive, cancellationToken);
        if (!ownerIsActiveMember)
        {
            throw new NotFoundException("Responsável");
        }

        var ids = request.Ids.Distinct().ToList();
        var leads = await context.FoundLeads
            .Where(l => ids.Contains(l.Id) && l.OrganizationId == organizationId && l.Status != FoundLeadStatus.Imported)
            .ToListAsync(cancellationToken);

        if (leads.Count == 0)
        {
            return new ImportFoundLeadsResult(0, ids.Count, []);
        }

        var searchIds = leads.Select(l => l.LeadSearchId).Distinct().ToList();
        var searchQueries = await context.LeadSearches
            .AsNoTracking()
            .Where(s => searchIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.Query, cancellationToken);

        var existingCompanyIds = leads.Where(l => l.ExistingCompanyId != null).Select(l => l.ExistingCompanyId!.Value).Distinct().ToList();
        var existingCompanies = await context.Companies
            .Where(c => existingCompanyIds.Contains(c.Id) && c.OrganizationId == organizationId)
            .ToDictionaryAsync(c => c.Id, cancellationToken);
        var openDealByCompany = await context.Deals
            .AsNoTracking()
            .Where(d => existingCompanyIds.Contains(d.CompanyId) && d.OrganizationId == organizationId && d.Status == DealStatus.Aberto)
            .GroupBy(d => d.CompanyId)
            .Select(g => new { CompanyId = g.Key, DealId = g.OrderByDescending(d => d.CreatedAt).Select(d => d.Id).First() })
            .ToDictionaryAsync(x => x.CompanyId, x => x.DealId, cancellationToken);

        var clock = await organizationClock.SnapshotAsync(cancellationToken);
        var nowUtc = clock.UtcNow;
        var callDueUtc = CallDueDate(clock);

        var dealIds = new List<Guid>(leads.Count);
        Deal? lastCreatedDeal = null;

        foreach (var lead in leads)
        {
            Guid companyId;
            if (lead.ExistingCompanyId is { } existing && existingCompanies.TryGetValue(existing, out var existingCompany))
            {
                FillMissingChannels(existingCompany, lead);
                companyId = existing;
            }
            else
            {
                companyId = AddCompany(lead, organizationId, searchQueries.GetValueOrDefault(lead.LeadSearchId));
            }

            if (!openDealByCompany.TryGetValue(companyId, out var dealId))
            {
                var deal = Deal.Create(
                    organizationId,
                    companyId,
                    contactId: null,
                    DealStage.Prospect,
                    DealSource.LeadFinder,
                    ownerUserId,
                    ticket: null,
                    amount: null,
                    createdByUserId: userId,
                    nowUtc);
                context.Deals.Add(deal);
                context.IntegrationEvents.Add(DealCreatedEvent(deal));
                dealId = deal.Id;
                openDealByCompany[companyId] = dealId;
                lastCreatedDeal = deal;

                if (request.ScheduleCall)
                {
                    context.Tasks.Add(TaskItem.Create(organizationId, dealId, ActivityType.Call, callDueUtc, ownerUserId, CallNote(lead)));
                }
            }

            lead.MarkImported(companyId, dealId, userId, nowUtc);
            dealIds.Add(dealId);
        }

        await context.SaveChangesAsync(cancellationToken);

        // Um aviso basta: as telas abertas refazem as próprias consultas.
        if (lastCreatedDeal is not null)
        {
            await publisher.Publish(new DealCreatedNotification(organizationId, lastCreatedDeal.Id, ownerUserId), cancellationToken);
        }

        foreach (var searchId in searchIds)
        {
            await publisher.Publish(new LeadSearchUpdatedNotification(organizationId, searchId), cancellationToken);
        }

        return new ImportFoundLeadsResult(leads.Count, ids.Count - leads.Count, dealIds.Distinct().ToList());
    }

    private Guid AddCompany(FoundLead lead, Guid organizationId, string? searchQuery)
    {
        var company = new Company
        {
            OrganizationId = organizationId,
            Name = Truncate(lead.Name, CompanyNameMaxLength)!,
            Segment = Truncate(lead.Category ?? searchQuery, CompanySegmentMaxLength),
            City = Truncate(lead.City, CompanyCityMaxLength),
            Instagram = Truncate(lead.Instagram, CompanyInstagramMaxLength),
            Phone = Truncate(lead.Phone, CompanyPhoneMaxLength),
            Website = Truncate(lead.Website, CompanyWebsiteMaxLength),
        };
        context.Companies.Add(company);
        return company.Id;
    }

    /// <summary>
    /// Empresa já cadastrada ganha do lead só o que ainda não tinha — o que o time digitou à mão
    /// nunca é sobrescrito pelo buscador.
    /// </summary>
    private static void FillMissingChannels(Company company, FoundLead lead)
    {
        company.Instagram ??= Truncate(lead.Instagram, CompanyInstagramMaxLength);
        company.Phone ??= Truncate(lead.Phone, CompanyPhoneMaxLength);
        company.Website ??= Truncate(lead.Website, CompanyWebsiteMaxLength);
        company.City ??= Truncate(lead.City, CompanyCityMaxLength);
        company.Segment ??= Truncate(lead.Category, CompanySegmentMaxLength);
    }

    private static DateTime CallDueDate(OrganizationClockSnapshot clock)
    {
        var lateAfternoon = clock.StartOfDayUtc(clock.Today).Add(CallTimeOfDay);
        return lateAfternoon > clock.UtcNow ? lateAfternoon : clock.EndOfDayUtc(clock.Today);
    }

    /// <summary>O contexto que o SDR precisa na hora de ligar, sem abrir a ficha.</summary>
    private static string CallNote(FoundLead lead)
    {
        var parts = new List<string> { "Primeiro contato — lead do buscador" };
        if (lead.Rating is { } rating)
        {
            var reviews = lead.ReviewCount is { } count ? $" ({count.ToString("N0", PtBr)} avaliações)" : string.Empty;
            parts.Add($"nota {rating.ToString("0.0", PtBr)}{reviews}");
        }

        if (lead.Address is { } address)
        {
            parts.Add(address);
        }

        return Truncate(string.Join(" · ", parts), TaskNoteMaxLength)!;
    }

    private static readonly CultureInfo PtBr = CultureInfo.GetCultureInfo("pt-BR");

    private static IntegrationEvent DealCreatedEvent(Deal deal)
    {
        var payload = JsonSerializer.Serialize(new
        {
            dealId = deal.Id,
            companyId = deal.CompanyId,
            contactId = deal.ContactId,
            source = deal.Source.ToString(),
            stage = deal.Stage.ToString(),
            createdAt = deal.CreatedAt,
        });

        return IntegrationEvent.Create(deal.OrganizationId, IntegrationEventTypes.DealCreated, payload);
    }

    private static string? Truncate(string? value, int maxLength) =>
        value is null ? null : value.Length <= maxLength ? value : value[..maxLength].TrimEnd();
}
