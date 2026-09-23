/** Mesmos nomes do enum `Permission` do servidor. */
export type Permission =
  | "DashboardView"
  | "TasksView"
  | "InboxView"
  | "PipelineView"
  | "CompaniesView"
  | "ReportsView"
  | "TeamWideAccess"
  | "UsersManage"
  | "RolesManage"
  | "SettingsManage"

export type AuthenticatedUser = {
  userId: string
  organizationId: string
  name: string
  email: string
  roleId: string
  roleName: string
  permissions: Permission[]
}

export type Session = {
  token: string
  expiresAtUtc: string
  user: AuthenticatedUser
}

const STORAGE_KEY = "metup.session"

/** Só a interface: o servidor checa a permissão de novo em cada chamada. */
export function can(user: AuthenticatedUser, permission: Permission) {
  return user.permissions.includes(permission)
}

export function saveSession(session: Session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function getSession(): Session | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const session = JSON.parse(raw) as Session
    // Sessão salva antes dos cargos (sem permissões) não serve mais: pede login de novo.
    if (new Date(session.expiresAtUtc).getTime() <= Date.now() || !Array.isArray(session.user?.permissions)) {
      clearSession()
      return null
    }
    return session
  } catch {
    clearSession()
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY)
}
