import type { Permission } from "@/lib/auth"
import type { View } from "@/lib/url-state"

/** A permissão que abre cada tela. O servidor exige a mesma nos endpoints próprios da tela. */
export const viewPermission: Record<View, Permission> = {
  dashboard: "DashboardView",
  tarefas: "TasksView",
  inbox: "InboxView",
  pipeline: "PipelineView",
  empresas: "CompaniesView",
  relatorios: "ReportsView",
  usuarios: "UsersManage",
  cargos: "RolesManage",
}

export type PermissionInfo = { permission: Permission; label: string; description: string }

/** O catálogo que a tela de cargos mostra, na ordem e nos grupos em que aparece. */
export const permissionGroups: { label: string; description: string; items: PermissionInfo[] }[] = [
  {
    label: "Telas",
    description: "O que aparece no menu e pode ser aberto.",
    items: [
      { permission: "DashboardView", label: "Dashboard", description: "O que fazer hoje e os números do funil." },
      { permission: "TasksView", label: "Tarefas", description: "Follow-ups, ligações e próximas ações." },
      { permission: "InboxView", label: "Conversas", description: "Inbox de WhatsApp ligada aos negócios." },
      { permission: "PipelineView", label: "Pipeline", description: "Quadro de negócios por etapa." },
      { permission: "CompaniesView", label: "Empresas", description: "Empresas, contatos e fichas." },
      { permission: "ReportsView", label: "Relatórios", description: "Funil, desempenho, previsão e coortes." },
    ],
  },
  {
    label: "Alcance dos dados",
    description: "De quem são os negócios e tarefas que o cargo vê e opera.",
    items: [
      {
        permission: "TeamWideAccess",
        label: "Toda a equipe",
        description: "Vê e age nos negócios e tarefas de todos, e reatribui. Sem isto, só a própria carteira.",
      },
    ],
  },
  {
    label: "Administração",
    description: "Quem entra no sistema e o que cada um pode fazer.",
    items: [
      { permission: "UsersManage", label: "Usuários", description: "Criar usuários, trocar cargo, redefinir senha e desativar." },
      { permission: "RolesManage", label: "Cargos", description: "Criar cargos e definir as permissões de cada um." },
      { permission: "SettingsManage", label: "Configurações", description: "Configurações da organização e token de integração." },
    ],
  },
]

export const permissionLabels: Record<Permission, string> = Object.fromEntries(
  permissionGroups.flatMap((group) => group.items.map((item) => [item.permission, item.label]))
) as Record<Permission, string>
