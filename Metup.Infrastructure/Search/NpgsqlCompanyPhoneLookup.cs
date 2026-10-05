using Metup.Application.Common.Interfaces;
using Metup.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Metup.Infrastructure.Search;

/// <summary>
/// Casa telefones pelos últimos 10 dígitos direto no Postgres. A expressão do WHERE é a mesma do
/// índice <c>ix_companies_phone_key</c> (migration <c>AddLeadFinder</c>) — mudar uma exige mudar a
/// outra, senão a consulta volta a varrer a tabela de empresas.
/// </summary>
public sealed class NpgsqlCompanyPhoneLookup(MetupDbContext context) : ICompanyPhoneLookup
{
    public async Task<IReadOnlyDictionary<string, Guid>> FindByPhonesAsync(
        Guid organizationId,
        IReadOnlyCollection<string> significantPhones,
        CancellationToken cancellationToken)
    {
        if (significantPhones.Count == 0)
        {
            return new Dictionary<string, Guid>();
        }

        var phones = significantPhones.ToArray();

        // SQL cru não passa pelo filtro global de organização: o escopo vai explícito no WHERE.
        var rows = await context.Database
            .SqlQuery<CompanyPhoneRow>($"""
                SELECT DISTINCT ON (phone_key) phone_key AS "PhoneKey", id AS "CompanyId"
                FROM (
                    SELECT id, right(regexp_replace(phone, '\D', '', 'g'), 10) AS phone_key
                    FROM companies
                    WHERE organization_id = {organizationId}
                      AND phone IS NOT NULL
                      AND right(regexp_replace(phone, '\D', '', 'g'), 10) = ANY({phones})
                ) matches
                ORDER BY phone_key, id
                """)
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(r => r.PhoneKey, r => r.CompanyId);
    }

    private sealed class CompanyPhoneRow
    {
        public string PhoneKey { get; init; } = string.Empty;

        public Guid CompanyId { get; init; }
    }
}
