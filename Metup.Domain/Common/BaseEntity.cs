namespace Metup.Domain.Common;

public abstract class BaseEntity
{
    public Guid Id { get; init; } = Guid.NewGuid();

    public Guid OrganizationId { get; init; }
}
