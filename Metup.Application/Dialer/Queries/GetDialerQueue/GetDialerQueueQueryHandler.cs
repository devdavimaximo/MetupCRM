using Metup.Application.Common.Extensions;
using Metup.Application.Common.Interfaces;
using Metup.Application.Dialer.Common;
using Metup.Domain.Activities;
using Metup.Domain.Deals;
using Metup.Domain.Tasks;
using Metup.Domain.Users;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Dialer.Queries.GetDialerQueue;

/// <remarks>
/// Três leituras: a fila (tarefa → negócio → empresa/contato), o histórico de ligações e o que o
/// buscador trouxe sobre os negócios da fila. Juntar em memória mantém cada consulta simples e
/// indexada, e a fila é limitada a <see cref="MaxItems"/>.
///
/// Negócio com mais de uma ligação pendente aparece uma vez, pela mais antiga: registrar a ligação
/// conclui essa; as outras seguem na tela de Tarefas.
/// </remarks>
public class GetDialerQueueQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IOrganizationClock organizationClock) : IRequestHandler<GetDialerQueueQuery, DialerQueueDto>
{
    public const int MaxItems = 500;

    public async Task<DialerQueueDto> Handle(GetDialerQueueQuery request, CancellationToken cancellationToken)
    {
        currentUserService.RequirePermission(Permission.DialerView);
        var organizationId = currentUserService.RequireOrganizationId();
        var userId = currentUserService.RequireUserId();

        var clock = await organizationClock.SnapshotAsync(cancellationToken);
        var dayEndUtc = clock.StartOfDayUtc(clock.Today.AddDays(1));

        var dueCalls =
            from t in context.Tasks
            join d in context.Deals on t.DealId equals d.Id
            where t.OrganizationId == organizationId
                && t.OwnerUserId == userId
                && t.Type == ActivityType.Call
                && t.Status == TaskItemStatus.Pendente
                && t.DueDate < dayEndUtc
                && d.Status == DealStatus.Aberto
            select new { Task = t, Deal = d };

        var totalCount = await dueCalls.CountAsync(cancellationToken);

        var rows = await (
                from x in dueCalls
                join c in context.Companies on x.Deal.CompanyId equals c.Id
                join ct in context.Contacts on x.Deal.ContactId equals (Guid?)ct.Id into contacts
                from ct in contacts.DefaultIfEmpty()
                orderby x.Task.DueDate, x.Task.Id
                select new QueueRow(
                    x.Task.Id,
                    x.Task.DueDate,
                    x.Task.Note,
                    x.Deal.Id,
                    x.Deal.Stage,
                    x.Deal.Source,
                    c.Id,
                    c.Name,
                    c.Segment,
                    c.City,
                    c.Website,
                    c.Instagram,
                    c.Phone,
                    ct != null ? (Guid?)ct.Id : null,
                    ct != null ? ct.Name : null,
                    ct != null ? ct.Role : null,
                    ct != null ? ct.Phone : null,
                    ct != null ? ct.WhatsApp : null))
            .AsNoTracking()
            .Take(MaxItems)
            .ToListAsync(cancellationToken);

        var queue = rows.DistinctBy(r => r.DealId).ToList();
        var dealIds = queue.Select(r => r.DealId).ToList();

        var history = await CallHistoryAsync(dealIds, cancellationToken);
        var leads = await LeadsAsync(dealIds, cancellationToken);

        var items = queue
            .Select(r => new DialerQueueItemDto(
                r.TaskId,
                r.DueDate,
                r.DueDate < clock.UtcNow,
                r.TaskNote,
                r.DealId,
                r.Stage,
                r.Source,
                r.CompanyId,
                r.CompanyName,
                r.Segment,
                r.City,
                r.Website,
                r.Instagram,
                r.ContactId,
                r.ContactName,
                r.ContactRole,
                Phones(r),
                history.GetValueOrDefault(r.DealId) ?? new DialerCallHistoryDto(0, null, null),
                leads.GetValueOrDefault(r.DealId)))
            .ToList();

        return new DialerQueueDto(items, totalCount, clock.Today, clock.UtcNow);
    }

    private async Task<Dictionary<Guid, DialerCallHistoryDto>> CallHistoryAsync(List<Guid> dealIds, CancellationToken cancellationToken)
    {
        var calls = await context.Activities
            .AsNoTracking()
            .Where(a => dealIds.Contains(a.DealId) && a.Type == ActivityType.Call)
            .Select(a => new { a.DealId, a.Outcome, a.OccurredAt })
            .ToListAsync(cancellationToken);

        return calls
            .GroupBy(a => a.DealId)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var last = g.MaxBy(a => a.OccurredAt)!;
                    return new DialerCallHistoryDto(g.Count(), last.Outcome, last.OccurredAt);
                });
    }

    /// <summary>Um lugar pode ter vindo em mais de uma busca ligada ao mesmo negócio: vale o primeiro achado.</summary>
    private async Task<Dictionary<Guid, DialerLeadDto>> LeadsAsync(List<Guid> dealIds, CancellationToken cancellationToken)
    {
        var leads = await (
                from l in context.FoundLeads
                join s in context.LeadSearches on l.LeadSearchId equals s.Id
                where l.DealId != null && dealIds.Contains(l.DealId.Value)
                select new
                {
                    DealId = l.DealId!.Value,
                    l.FoundAt,
                    Dto = new DialerLeadDto(l.LeadSearchId, s.Query, s.Location, l.Category, l.Rating, l.ReviewCount, l.Address, l.MapsUrl),
                })
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return leads
            .GroupBy(l => l.DealId)
            .ToDictionary(g => g.Key, g => g.MinBy(l => l.FoundAt)!.Dto);
    }

    /// <summary>Contato antes da empresa: quem decide atende no número dele. Repetidos saem.</summary>
    private static IReadOnlyList<DialerPhoneDto> Phones(QueueRow row)
    {
        (DialerPhoneKind Kind, string? Value)[] candidates =
        [
            (DialerPhoneKind.Contact, row.ContactPhone),
            (DialerPhoneKind.ContactWhatsApp, row.ContactWhatsApp),
            (DialerPhoneKind.Company, row.CompanyPhone),
        ];

        var phones = new List<DialerPhoneDto>();
        foreach (var (kind, value) in candidates)
        {
            if (string.IsNullOrWhiteSpace(value) || phones.Any(p => p.Display.MatchesPhone(value)))
            {
                continue;
            }

            phones.Add(new DialerPhoneDto(kind, value.Trim(), value.ToDialString()));
        }

        return phones;
    }

    private sealed record QueueRow(
        Guid TaskId,
        DateTime DueDate,
        string? TaskNote,
        Guid DealId,
        DealStage Stage,
        DealSource Source,
        Guid CompanyId,
        string CompanyName,
        string? Segment,
        string? City,
        string? Website,
        string? Instagram,
        string? CompanyPhone,
        Guid? ContactId,
        string? ContactName,
        string? ContactRole,
        string? ContactPhone,
        string? ContactWhatsApp);
}
