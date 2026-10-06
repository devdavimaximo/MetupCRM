using Metup.Application.Common.Interfaces;
using Metup.Domain.Common.Exceptions;
using Metup.Domain.Telephony;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Telephony.Common;

/// <summary>
/// As regras que olham para as outras linhas da organização — por isso ficam no caso de uso, não na
/// entidade. Criar, editar e reativar passam por aqui.
/// </summary>
public static class PhoneLineRules
{
    public const string NumberFormatMessage = "Informe o número com DDD, ex.: (11) 91234-5678.";

    /// <summary>
    /// Um número ativo pertence a uma pessoa só: duas pessoas "ligando do mesmo número" misturariam as
    /// ligações de SDRs diferentes. O índice único parcial no banco garante o mesmo sob concorrência.
    /// </summary>
    public static async Task EnsureNumberAvailableAsync(
        this IApplicationDbContext context,
        Guid organizationId,
        string numberE164,
        Guid? exceptLineId,
        CancellationToken cancellationToken)
    {
        var holder = await (
                from l in context.PhoneLines
                join u in context.Users on l.UserId equals u.Id
                where l.OrganizationId == organizationId && l.IsActive && l.NumberE164 == numberE164 && l.Id != exceptLineId
                select u.Name)
            .FirstOrDefaultAsync(cancellationToken);

        if (holder is not null)
        {
            throw new DomainRuleException($"Este número já é uma linha ativa de {holder}. Cada número fica com uma pessoa só.");
        }
    }

    /// <summary>Tira a marca de principal das outras linhas do usuário (carregadas e rastreadas).</summary>
    public static async Task ClearOtherDefaultsAsync(
        this IApplicationDbContext context,
        Guid organizationId,
        Guid userId,
        Guid keepLineId,
        CancellationToken cancellationToken)
    {
        var others = await context.PhoneLines
            .Where(l => l.OrganizationId == organizationId && l.UserId == userId && l.IsDefault && l.Id != keepLineId)
            .ToListAsync(cancellationToken);

        foreach (var line in others)
        {
            line.ClearDefault();
        }
    }

    /// <summary>Usuário sem linha principal ativa recebe a mais recente das ativas (se houver).</summary>
    public static async Task EnsureUserHasDefaultAsync(
        this IApplicationDbContext context,
        Guid organizationId,
        Guid userId,
        Guid? exceptLineId,
        CancellationToken cancellationToken)
    {
        var active = await context.PhoneLines
            .Where(l => l.OrganizationId == organizationId && l.UserId == userId && l.IsActive && l.Id != exceptLineId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync(cancellationToken);

        if (active.Count > 0 && !active.Any(l => l.IsDefault))
        {
            active[0].MakeDefault();
        }
    }
}
