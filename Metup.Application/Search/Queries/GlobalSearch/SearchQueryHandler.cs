using Metup.Application.Common.Interfaces;
using Metup.Application.Search.Common;
using Metup.Domain.Deals;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Search.Queries.GlobalSearch;

/// <summary>
/// Empresas e contatos são a base de prospecção da organização inteira (a tela de Empresas também
/// é da organização toda); negócios seguem o escopo do papel (<c>ResolveDealScope</c>): o SDR só
/// encontra os dele. Todo "contém" ignora maiúsculas e acentos (<see cref="ITextSearch"/>).
/// </summary>
public class SearchQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    ITextSearch textSearch) : IRequestHandler<SearchQuery, SearchResultDto>
{
    public async Task<SearchResultDto> Handle(SearchQuery request, CancellationToken cancellationToken)
    {
        var scope = currentUserService.ResolveDealScope();
        var term = request.Term.Trim();
        var take = SearchQuery.MaxHitsPerGroup;

        var companies = await textSearch
            .WhereAnyContains(
                context.Companies.AsNoTracking().Where(c => c.OrganizationId == scope.OrganizationId),
                term,
                c => c.Name, c => c.City, c => c.Segment)
            .OrderBy(c => c.Name)
            .Take(take)
            .Select(c => new CompanySearchHitDto(c.Id, c.Name, c.Segment, c.City))
            .ToListAsync(cancellationToken);

        var contacts = await textSearch
            .WhereAnyContains(
                context.Contacts.AsNoTracking().Where(c => c.OrganizationId == scope.OrganizationId),
                term,
                c => c.Name, c => c.Email)
            .OrderBy(c => c.Name)
            .Take(take)
            .Select(c => new ContactSearchHitDto(
                c.Id,
                c.Name,
                c.CompanyId,
                context.Companies.Where(co => co.Id == c.CompanyId).Select(co => co.Name).First(),
                c.Role))
            .ToListAsync(cancellationToken);

        // Negócio não tem nome próprio: é encontrado pela empresa. Subconsulta, nunca a lista de ids em memória.
        var matchingCompanyIds = textSearch
            .WhereAnyContains(
                context.Companies.AsNoTracking().Where(c => c.OrganizationId == scope.OrganizationId),
                term,
                c => c.Name)
            .Select(c => c.Id);

        var deals = context.Deals
            .AsNoTracking()
            .Where(d => d.OrganizationId == scope.OrganizationId && matchingCompanyIds.Contains(d.CompanyId));
        if (scope.OwnerUserId is { } ownerUserId)
        {
            deals = deals.Where(d => d.OwnerUserId == ownerUserId);
        }

        var dealHits = await deals
            // Abertos primeiro, depois os de maior valor: é o que a pessoa costuma procurar.
            .OrderBy(d => d.Status == DealStatus.Aberto ? 0 : 1)
            .ThenByDescending(d => d.Amount ?? d.Ticket)
            .Take(take)
            .Select(d => new DealSearchHitDto(
                d.Id,
                d.CompanyId,
                context.Companies.Where(co => co.Id == d.CompanyId).Select(co => co.Name).First(),
                d.Stage,
                d.Status,
                d.Amount ?? d.Ticket,
                context.Users.Where(u => u.Id == d.OwnerUserId).Select(u => u.Name).FirstOrDefault()))
            .ToListAsync(cancellationToken);

        // Conversas são da organização inteira, sem responsável (a Inbox é compartilhada) — mesmo
        // critério de nome usado na lista de Conversas: contato ou empresa, nunca o corpo da mensagem.
        var matchingContactIds = textSearch
            .WhereAnyContains(context.Contacts.AsNoTracking().Where(c => c.OrganizationId == scope.OrganizationId), term, c => c.Name)
            .Select(c => c.Id);

        var conversationHits = await context.Conversations
            .AsNoTracking()
            .Where(c => c.OrganizationId == scope.OrganizationId)
            .Join(context.Contacts, c => c.ContactId, ct => ct.Id, (c, ct) => new { Conversation = c, Contact = ct })
            .Join(context.Companies, x => x.Contact.CompanyId, co => co.Id, (x, co) => new { x.Conversation, x.Contact, Company = co })
            .Where(x => matchingContactIds.Contains(x.Contact.Id) || matchingCompanyIds.Contains(x.Company.Id))
            .OrderByDescending(x => x.Conversation.LastMessageAt ?? x.Conversation.CreatedAt)
            .Take(take)
            .Select(x => new ConversationSearchHitDto(
                x.Conversation.Id,
                x.Contact.Name,
                x.Company.Name,
                context.Messages
                    .Where(m => m.ConversationId == x.Conversation.Id)
                    .OrderByDescending(m => m.OccurredAt)
                    .Select(m => m.Body)
                    .FirstOrDefault()))
            .ToListAsync(cancellationToken);

        return new SearchResultDto(companies, contacts, dealHits, conversationHits);
    }
}
