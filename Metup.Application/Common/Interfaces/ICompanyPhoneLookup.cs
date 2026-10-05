namespace Metup.Application.Common.Interfaces;

/// <summary>
/// Acha empresas já cadastradas pelo telefone, comparando só os dígitos significativos (os últimos
/// 10, como <c>PhoneExtensions.MatchesPhone</c>). Fica atrás de interface porque o telefone da
/// empresa é texto livre com máscara: no Postgres a comparação usa um índice de expressão sobre os
/// dígitos, sem trazer a tabela de empresas para a memória.
/// </summary>
public interface ICompanyPhoneLookup
{
    /// <returns>Dígitos significativos → empresa (a mais antiga, se houver mais de uma).</returns>
    Task<IReadOnlyDictionary<string, Guid>> FindByPhonesAsync(
        Guid organizationId,
        IReadOnlyCollection<string> significantPhones,
        CancellationToken cancellationToken);
}
