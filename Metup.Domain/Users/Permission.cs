namespace Metup.Domain.Users;

/// <summary>
/// O que um cargo libera. Gravado como texto (nome do enum) — renomear um membro é migration.
/// Três famílias: telas (<c>*View</c>), alcance do dado (<see cref="TeamWideAccess"/>) e
/// administração (<c>*Manage</c>).
/// </summary>
public enum Permission
{
    DashboardView,
    TasksView,
    InboxView,
    PipelineView,
    CompaniesView,
    ReportsView,

    /// <summary>
    /// Ver e agir nos negócios e tarefas de toda a equipe (reatribuir inclusive). Sem ela, o
    /// usuário fica restrito à própria carteira — o antigo "SDR".
    /// </summary>
    TeamWideAccess,

    UsersManage,
    RolesManage,
    SettingsManage,
}
