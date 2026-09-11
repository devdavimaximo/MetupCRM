export type AuthenticatedUser = {
  userId: string
  organizationId: string
  name: string
  email: string
  role: "Admin" | "Closer" | "Sdr"
}

export type Session = {
  token: string
  expiresAtUtc: string
  user: AuthenticatedUser
}

const STORAGE_KEY = "metup.session"

export function saveSession(session: Session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function getSession(): Session | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const session = JSON.parse(raw) as Session
    if (new Date(session.expiresAtUtc).getTime() <= Date.now()) {
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
