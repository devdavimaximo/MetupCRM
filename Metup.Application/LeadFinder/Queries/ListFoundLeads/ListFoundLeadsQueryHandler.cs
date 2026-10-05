using Metup.Application.Common.Extensions;
using Metup.Application.Common.Interfaces;
using Metup.Application.LeadFinder.Common;
using Metup.Domain.LeadFinder;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.LeadFinder.Queries.ListFoundLeads;

/// <summary>
/// A tabela de triagem: paginada no servidor (listas garimpadas passam de milhares) e com a contagem
/// por situação do mesmo recorte, para as abas Novos · Importados · Descartados sem consulta extra
/// por aba. Os índices de <c>found_leads</c> começam por organização + busca/situação.
/// </summary>
public class ListFoundLeadsQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    ITextSearch textSearch) : IRequestHandler<ListFoundLeadsQuery, FoundLeadPageDto>
{
    public async Task<FoundLeadPageDto> Handle(ListFoundLeadsQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var scoped = context.FoundLeads
            .AsNoTracking()
            .Where(l => l.OrganizationId == organizationId);

        if (request.LeadSearchId is { } searchId)
        {
            scoped = scoped.Where(l => l.LeadSearchId == searchId);
        }

        if (request.Search.NormalizeOptional() is { } term)
        {
            scoped = textSearch.WhereAnyContains(scoped, term, l => l.Name, l => l.Category, l => l.Address, l => l.City, l => l.Phone);
        }

        if (request.HasPhone is { } hasPhone)
        {
            scoped = hasPhone ? scoped.Where(l => l.PhoneDigits != null) : scoped.Where(l => l.PhoneDigits == null);
        }

        if (request.HasWebsite is { } hasWebsite)
        {
            scoped = hasWebsite ? scoped.Where(l => l.Website != null) : scoped.Where(l => l.Website == null);
        }

        if (request.MinRating is { } minRating)
        {
            scoped = scoped.Where(l => l.Rating >= minRating);
        }

        var countsByStatus = await scoped
            .GroupBy(l => l.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count, cancellationToken);

        var counts = new FoundLeadStatusCounts(
            countsByStatus.GetValueOrDefault(FoundLeadStatus.New),
            countsByStatus.GetValueOrDefault(FoundLeadStatus.Imported),
            countsByStatus.GetValueOrDefault(FoundLeadStatus.Discarded));

        var filtered = scoped.Where(l => l.Status == request.Status);
        var totalCount = countsByStatus.GetValueOrDefault(request.Status);

        var items = await Sort(filtered, request.Sort)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToDto()
            .ToListAsync(cancellationToken);

        return new FoundLeadPageDto(items, request.Page, request.PageSize, totalCount, counts);
    }

    /// <summary>
    /// Nulos sempre no fim (no Postgres, DESC põe NULL primeiro) e o id como desempate: a mesma página
    /// devolve sempre as mesmas linhas.
    /// </summary>
    private static IQueryable<FoundLead> Sort(IQueryable<FoundLead> leads, FoundLeadSort sort) => sort switch
    {
        FoundLeadSort.Reviews => leads
            .OrderBy(l => l.ReviewCount == null)
            .ThenByDescending(l => l.ReviewCount)
            .ThenByDescending(l => l.Rating)
            .ThenBy(l => l.Id),
        FoundLeadSort.Name => leads.OrderBy(l => l.Name).ThenBy(l => l.Id),
        FoundLeadSort.Recent => leads.OrderByDescending(l => l.FoundAt).ThenBy(l => l.Id),
        _ => leads
            .OrderBy(l => l.Rating == null)
            .ThenByDescending(l => l.Rating)
            .ThenBy(l => l.ReviewCount == null)
            .ThenByDescending(l => l.ReviewCount)
            .ThenBy(l => l.Id),
    };
}
