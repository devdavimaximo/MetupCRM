using System.Net.Mail;
using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Extensions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Realtime;
using Metup.Application.LeadFinder.Common;
using Metup.Domain.LeadFinder;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Integrations.Commands.ReceiveLeadSearchResults;

/// <summary>
/// Recebe um lote de leads garimpados pela automação (n8n → CRM). Idempotente: reenviar o mesmo lote
/// não duplica nada (a <see cref="LeadDedupe"/> é do CRM e única por organização). O CRM valida e
/// normaliza tudo que chega — não confia no payload (seção 5 do CLAUDE.md).
///
/// Custo fixo por lote, não por lead: uma consulta pelas chaves já existentes, uma pelos telefones de
/// empresas já cadastradas (índice de expressão) e um único <c>SaveChanges</c>.
/// </summary>
public class ReceiveLeadSearchResultsCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    ICompanyPhoneLookup companyPhoneLookup,
    IPublisher publisher) : IRequestHandler<ReceiveLeadSearchResultsCommand, LeadBatchResultDto>
{
    public async Task<LeadBatchResultDto> Handle(ReceiveLeadSearchResultsCommand request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();
        var nowUtc = DateTime.UtcNow;

        var search = await context.LeadSearches
            .FirstOrDefaultAsync(s => s.Id == request.LeadSearchId && s.OrganizationId == organizationId, cancellationToken)
            ?? throw new NotFoundException("Busca");

        if (search.Status == LeadSearchStatus.Cancelled)
        {
            return new LeadBatchResultDto(request.Leads.Count, 0, 0, 0, search.Status);
        }

        var candidates = new Dictionary<string, FoundLead>();
        var rejected = 0;
        var filtered = 0;
        var duplicatesInBatch = 0;
        foreach (var incoming in request.Leads)
        {
            var lead = Normalize(incoming, search, nowUtc);
            if (lead is null)
            {
                rejected++;
            }
            else if (!search.Accepts(lead.Website))
            {
                filtered++;
            }
            else if (!candidates.TryAdd(lead.DedupeKey, lead))
            {
                duplicatesInBatch++;
            }
        }

        var keys = candidates.Keys.ToList();
        var knownRows = await context.FoundLeads
            .AsNoTracking()
            .Where(l => l.OrganizationId == organizationId && keys.Contains(l.DedupeKey))
            .Select(l => new { l.DedupeKey, l.LeadSearchId })
            .ToListAsync(cancellationToken);
        var known = knownRows.Select(r => r.DedupeKey).ToHashSet();
        var fresh = candidates.Values.Where(l => !known.Contains(l.DedupeKey)).ToList();

        // "Encontrados" da busca = inéditos + os que já estavam na base por outra busca. O que esta
        // mesma busca já tinha recebido é reenvio do n8n e não conta de novo.
        var foundByOtherSearches = knownRows.Count(r => r.LeadSearchId != search.Id);

        var phones = fresh
            .Select(l => LeadDedupe.SignificantPhone(l.PhoneDigits))
            .OfType<string>()
            .Distinct()
            .ToList();
        var companiesByPhone = phones.Count == 0
            ? new Dictionary<string, Guid>()
            : await companyPhoneLookup.FindByPhonesAsync(organizationId, phones, cancellationToken);

        foreach (var lead in fresh)
        {
            if (LeadDedupe.SignificantPhone(lead.PhoneDigits) is { } phone && companiesByPhone.TryGetValue(phone, out var companyId))
            {
                lead.ExistingCompanyId = companyId;
            }

            context.FoundLeads.Add(lead);
        }

        search.RegisterBatch(fresh.Count + foundByOtherSearches, fresh.Count, nowUtc);

        await context.SaveChangesAsync(cancellationToken);
        await publisher.Publish(new LeadSearchUpdatedNotification(organizationId, search.Id), cancellationToken);

        return new LeadBatchResultDto(
            request.Leads.Count,
            fresh.Count,
            known.Count + duplicatesInBatch,
            rejected,
            search.Status,
            filtered);
    }

    private static FoundLead? Normalize(IncomingLead incoming, LeadSearch search, DateTime nowUtc)
    {
        var name = Clip(incoming.Name, FoundLead.NameMaxLength);
        if (name is null)
        {
            return null;
        }

        var phone = Clip(incoming.Phone, FoundLead.PhoneMaxLength);
        var phoneDigits = LeadDedupe.PhoneDigits(phone);
        var externalId = Clip(incoming.ExternalId, FoundLead.ExternalIdMaxLength);
        var city = Clip(incoming.City, FoundLead.CityMaxLength);

        return new FoundLead
        {
            OrganizationId = search.OrganizationId,
            LeadSearchId = search.Id,
            DedupeKey = Clip(LeadDedupe.Key(phoneDigits, externalId, name, city), FoundLead.DedupeKeyMaxLength)!,
            ExternalId = externalId,
            Name = name,
            Category = Clip(incoming.Category, FoundLead.CategoryMaxLength),
            Phone = phone,
            PhoneDigits = phoneDigits,
            Website = WebUrl(incoming.Website, FoundLead.WebsiteMaxLength),
            Email = Email(incoming.Email),
            Instagram = Clip(incoming.Instagram, FoundLead.InstagramMaxLength),
            Address = Clip(incoming.Address, FoundLead.AddressMaxLength),
            City = city,
            State = Clip(incoming.State, FoundLead.StateMaxLength),
            Rating = incoming.Rating is >= 0 and <= 5 ? Math.Round(incoming.Rating.Value, 1) : null,
            ReviewCount = incoming.ReviewCount is >= 0 ? incoming.ReviewCount : null,
            MapsUrl = WebUrl(incoming.MapsUrl, FoundLead.MapsUrlMaxLength),
            FoundAt = nowUtc,
        };
    }

    private static string? Clip(string? value, int maxLength) =>
        value.NormalizeOptional() is not { } text ? null : text.Length <= maxLength ? text : text[..maxLength].TrimEnd();

    /// <summary>Só http(s) — a tela transforma isto em link, então nada de <c>javascript:</c> vindo da automação.</summary>
    private static string? WebUrl(string? value, int maxLength)
    {
        var text = value.NormalizeOptional();
        if (text is null || text.Length > maxLength)
        {
            return null;
        }

        if (!text.Contains("://", StringComparison.Ordinal))
        {
            text = $"https://{text}";
        }

        return Uri.TryCreate(text, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp)
            ? text
            : null;
    }

    private static string? Email(string? value)
    {
        var text = Clip(value, FoundLead.EmailMaxLength);
        return text is not null && MailAddress.TryCreate(text, out _) ? text : null;
    }
}
