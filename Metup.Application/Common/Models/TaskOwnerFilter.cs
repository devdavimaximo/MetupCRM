namespace Metup.Application.Common.Models;

/// <summary>
/// De quem são as tarefas que um caso de uso enxerga, já resolvido e autorizado. Sem
/// <see cref="OwnerUserId"/> = todos os responsáveis da organização (só Admin/Closer chegam aqui).
/// </summary>
public readonly record struct TaskOwnerFilter(Guid OrganizationId, Guid? OwnerUserId);
