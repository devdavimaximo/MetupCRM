using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Application.LeadFinder.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.LeadFinder.Queries.ListLeadSearches;

/// <summary>Histórico de buscas da organização, mais recentes primeiro.</summary>
public record ListLeadSearchesQuery(int Limit) : IRequest<IReadOnlyList<LeadSearchDto>>;

/// <summary>Uma busca. Serve à tela e ao n8n (que confere o pedido antes de começar a garimpar).</summary>
public record GetLeadSearchQuery(Guid LeadSearchId) : IRequest<LeadSearchDto>;

public class LeadSearchQueriesHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) :
    IRequestHandler<ListLeadSearchesQuery, IReadOnlyList<LeadSearchDto>>,
    IRequestHandler<GetLeadSearchQuery, LeadSearchDto>
{
    public const int MaxLimit = 100;

    public async Task<IReadOnlyList<LeadSearchDto>> Handle(ListLeadSearchesQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        return await context.LeadSearches
            .AsNoTracking()
            .Where(s => s.OrganizationId == organizationId)
            .OrderByDescending(s => s.RequestedAt)
            .ThenBy(s => s.Id)
            .Take(Math.Clamp(request.Limit, 1, MaxLimit))
            .ToDtoListAsync(context, DateTime.UtcNow, cancellationToken);
    }

    public async Task<LeadSearchDto> Handle(GetLeadSearchQuery request, CancellationToken cancellationToken)
    {
        var organizationId = currentUserService.RequireOrganizationId();

        var found = await context.LeadSearches
            .AsNoTracking()
            .Where(s => s.Id == request.LeadSearchId && s.OrganizationId == organizationId)
            .ToDtoListAsync(context, DateTime.UtcNow, cancellationToken);

        return found.FirstOrDefault() ?? throw new NotFoundException("Busca");
    }
}
