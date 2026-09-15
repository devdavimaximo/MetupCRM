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

    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}
