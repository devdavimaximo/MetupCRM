using Metup.Application.Common.Models;

namespace Metup.Application.Common.Interfaces;

/// <summary>
/// Fonte única do "agora" no fuso da organização atual (<c>Organization.TimeZoneId</c>).
/// Todo caso de uso que fala em "hoje", "período" ou "dia do gráfico" depende desta interface em
/// vez de <c>DateTime.UtcNow.Date</c>.
/// </summary>
public interface IOrganizationClock
{
    Task<OrganizationClockSnapshot> SnapshotAsync(CancellationToken cancellationToken);
}
