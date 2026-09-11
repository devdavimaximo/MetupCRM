namespace Metup.Domain.Organizations;

public class Organization
{
    public Guid Id { get; init; } = Guid.NewGuid();

    public string Name { get; set; } = string.Empty;

    /// <summary>Hash do service token do n8n para esta organização. Nulo = integração ainda não provisionada.</summary>
    public string? IntegrationTokenHash { get; set; }

    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}
