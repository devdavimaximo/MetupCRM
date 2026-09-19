import { getSession } from "@/lib/auth"

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5100"

export class ApiError extends Error {
  status: number
  errors?: Record<string, string[]>
  /** Estado atual do recurso num 409 de concorrência (ex.: o negócio que outro usuário já moveu). */
  current?: unknown

  constructor(message: string, status: number, errors?: Record<string, string[]>, current?: unknown) {
    super(message)
    this.status = status
    this.errors = errors
    this.current = current
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = getSession()

  const headers = new Headers(options.headers)
  headers.set("Content-Type", "application/json")
  if (session) {
    headers.set("Authorization", `Bearer ${session.token}`)
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (!response.ok) {
    const problem = await response.json().catch(() => null)
    throw new ApiError(
      problem?.title ?? "Não foi possível completar a solicitação.",
      response.status,
      problem?.errors,
      problem?.current
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
