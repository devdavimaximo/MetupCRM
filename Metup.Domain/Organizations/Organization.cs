using Metup.Domain.Common.Exceptions;

namespace Metup.Domain.Organizations;

public class Organization
{
    public Guid Id { get; init; } = Guid.NewGuid();

    public string Name { get; set; } = string.Empty;

    /// <summary>Hash do service token do n8n para esta organização. Nulo = integração ainda não provisionada.</summary>
    public string? IntegrationTokenHash { get; set; }

    /// <summary>
    /// Fuso em que a operação comercial da organização acontece (IANA, ex.: America/Sao_Paulo).
    /// "Hoje", os buckets da série e as janelas de período são recortados neste fuso — o banco
    /// continua guardando tudo em UTC.
    /// </summary>
    public string TimeZoneId { get; set; } = DefaultTimeZoneId;

    public const string DefaultTimeZoneId = "America/Sao_Paulo";

    /// <summary>
    /// Dias sem mudança de etapa a partir dos quais um negócio aberto conta como "parado". Um limite
    /// só para todas as etapas; ajustável por Admin.
    /// </summary>
    public int StalledDealDays { get; private set; } = DefaultStalledDealDays;

    public const int DefaultStalledDealDays = 14;
    public const int MinStalledDealDays = 1;
    public const int MaxStalledDealDays = 180;

    public void ChangeStalledDealDays(int days)
    {
        if (days is < MinStalledDealDays or > MaxStalledDealDays)
        {
            throw new DomainRuleException(
                $"O limite de negócio parado deve ficar entre {MinStalledDealDays} e {MaxStalledDealDays} dias.");
        }

        StalledDealDays = days;
    }

    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}
