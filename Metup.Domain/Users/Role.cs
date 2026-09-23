using Metup.Domain.Common;
using Metup.Domain.Common.Exceptions;

namespace Metup.Domain.Users;

/// <summary>
/// Cargo: o conjunto de permissões que um usuário recebe. Cada organização tem os seus. O cargo
/// administrador é do sistema — sempre tem todas as permissões (inclusive as que surgirem depois)
/// e não pode ser excluído.
/// </summary>
public class Role : BaseEntity
{
    public const int NameMaxLength = 80;
    public const int DescriptionMaxLength = 240;

    public string Name { get; private set; } = string.Empty;

    public string? Description { get; private set; }

    public bool IsAdministrator { get; private set; }

    /// <summary>Permissões gravadas. Para o administrador, use <see cref="EffectivePermissions"/>.</summary>
    public List<Permission> Permissions { get; private set; } = [];

    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

    public IReadOnlyList<Permission> EffectivePermissions =>
        IsAdministrator ? Enum.GetValues<Permission>() : [.. Permissions.Distinct().Order()];

    public static Role Create(Guid organizationId, string name, string? description, IEnumerable<Permission> permissions) =>
        new()
        {
            OrganizationId = organizationId,
            Name = name,
            Description = description,
            Permissions = [.. permissions.Distinct().Order()],
        };

    public static Role CreateAdministrator(Guid organizationId) =>
        new()
        {
            OrganizationId = organizationId,
            Name = "Administrador",
            Description = "Acesso total, inclusive usuários, cargos e configurações.",
            IsAdministrator = true,
            Permissions = [.. Enum.GetValues<Permission>()],
        };

    /// <summary>Os cargos com que toda organização nasce: administrador, closer e SDR.</summary>
    public static IReadOnlyList<Role> CreateDefaults(Guid organizationId) =>
    [
        CreateAdministrator(organizationId),
        Create(organizationId, "Closer", "Conduz reuniões e propostas; enxerga a equipe inteira.", DefaultPermissions.Closer),
        Create(organizationId, "SDR", "Prospecção e primeiro contato; opera a própria carteira.", DefaultPermissions.Sdr),
    ];

    public void Update(string name, string? description, IEnumerable<Permission> permissions)
    {
        var requested = permissions.Distinct().Order().ToList();
        if (IsAdministrator && requested.Count != Enum.GetValues<Permission>().Length)
        {
            throw new DomainRuleException("As permissões do cargo Administrador não podem ser alteradas.");
        }

        Name = name;
        Description = description;
        Permissions = requested;
    }

    public void EnsureCanBeDeleted(int assignedUsers)
    {
        if (IsAdministrator)
        {
            throw new DomainRuleException("O cargo Administrador não pode ser excluído.");
        }

        if (assignedUsers > 0)
        {
            throw new DomainRuleException("Há usuários neste cargo. Mova-os para outro cargo antes de excluir.");
        }
    }
}

/// <summary>Permissões dos cargos padrão — as mesmas regras que valiam para os papéis fixos.</summary>
public static class DefaultPermissions
{
    private static readonly Permission[] Pages =
    [
        Permission.DashboardView,
        Permission.TasksView,
        Permission.InboxView,
        Permission.PipelineView,
        Permission.CompaniesView,
        Permission.ReportsView,
    ];

    public static IReadOnlyList<Permission> Sdr { get; } = Pages;

    public static IReadOnlyList<Permission> Closer { get; } = [.. Pages, Permission.TeamWideAccess];

    public static IReadOnlyList<Permission> Administrator { get; } = Enum.GetValues<Permission>();

    public static IReadOnlyList<Permission> For(DefaultRole role) => role switch
    {
        DefaultRole.Admin => Administrator,
        DefaultRole.Closer => Closer,
        _ => Sdr,
    };
}
