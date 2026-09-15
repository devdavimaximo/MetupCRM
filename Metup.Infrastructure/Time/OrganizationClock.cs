using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Domain.Organizations;
using Microsoft.EntityFrameworkCore;

namespace Metup.Infrastructure.Time;

/// <summary>
/// Resolve o fuso da organização atual e congela um "agora" por requisição — dois cálculos da
/// mesma tela nunca caem em dias diferentes por causa da virada do relógio no meio do handler.
///
/// O fuso é guardado em IANA (<c>America/Sao_Paulo</c>). No Windows, onde o runtime só conhece os
/// ids da base própria, converte-se o id antes de procurar; um fuso desconhecido ou inválido cai
/// no padrão em vez de derrubar a tela.
/// </summary>
public class OrganizationClock(IApplicationDbContext context, ICurrentUserService currentUserService) : IOrganizationClock
{
    private OrganizationClockSnapshot? snapshot;

    public async Task<OrganizationClockSnapshot> SnapshotAsync(CancellationToken cancellationToken)
    {
        if (snapshot is not null)
        {
            return snapshot;
        }

        var organizationId = currentUserService.RequireOrganizationId();

        var timeZoneId = await context.Organizations
            .AsNoTracking()
            .Where(o => o.Id == organizationId)
            .Select(o => o.TimeZoneId)
            .FirstOrDefaultAsync(cancellationToken);

        snapshot = new OrganizationClockSnapshot(Resolve(timeZoneId), DateTime.UtcNow);
        return snapshot;
    }

    private static TimeZoneInfo Resolve(string? timeZoneId) =>
        Find(timeZoneId) ?? Find(Organization.DefaultTimeZoneId) ?? TimeZoneInfo.Utc;

    private static TimeZoneInfo? Find(string? timeZoneId)
    {
        if (string.IsNullOrWhiteSpace(timeZoneId))
        {
            return null;
        }

        if (TimeZoneInfo.TryFindSystemTimeZoneById(timeZoneId, out var timeZone))
        {
            return timeZone;
        }

        return TimeZoneInfo.TryConvertIanaIdToWindowsId(timeZoneId, out var windowsId)
            && TimeZoneInfo.TryFindSystemTimeZoneById(windowsId, out var converted)
            ? converted
            : null;
    }
}
