using Metup.Application.Common.Exceptions;
using Metup.Application.Common.Interfaces;
using Metup.Domain.Deals;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Deals.Common;

/// <summary>
/// Carrega o negócio alvo de uma ação já aplicando a permissão de
/// <see cref="CurrentUserServiceExtensions.ResolveDealActionScope"/>: fora da organização é 404 (não
/// vaza existência); dentro dela mas fora do escopo do usuário (SDR em negócio de outro) é 403.
/// Espelho de <c>TaskActionAccess</c> — a leitura do negócio continua aberta à organização.
/// </summary>
public static class DealActionAccess
{
    public static async Task<Deal> LoadDealForActionAsync(
        this IApplicationDbContext context,
        ICurrentUserService currentUserService,
        Guid dealId,
        CancellationToken cancellationToken)
    {
        var scope = currentUserService.ResolveDealActionScope();

        var deal = await context.Deals
            .FirstOrDefaultAsync(d => d.Id == dealId && d.OrganizationId == scope.OrganizationId, cancellationToken)
            ?? throw new NotFoundException("Negócio");

        if (scope.OwnerUserId is { } ownerUserId && deal.OwnerUserId != ownerUserId)
        {
            throw new ForbiddenAccessException("Sem permissão para alterar o negócio de outro usuário.");
        }

        return deal;
    }
}
