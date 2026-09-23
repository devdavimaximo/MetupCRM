import { apiFetch } from "@/lib/api"
import type { AuthenticatedUser, Permission } from "@/lib/auth"

export type ManagedUser = {
  id: string
  name: string
  email: string
  roleId: string
  roleName: string
  isActive: boolean
  createdAt: string
}

export type Role = {
  id: string
  name: string
  description: string | null
  isAdministrator: boolean
  permissions: Permission[]
  userCount: number
}

export type UserInput = { name: string; email: string; roleId: string }

export type RoleInput = { name: string; description: string | null; permissions: Permission[] }

export function getCurrentUser(signal?: AbortSignal) {
  return apiFetch<AuthenticatedUser>("/api/auth/me", { signal })
}

export function listManagedUsers(signal?: AbortSignal) {
  return apiFetch<ManagedUser[]>("/api/users/manage", { signal })
}

export function createUser(input: UserInput & { password: string }) {
  return apiFetch<ManagedUser>("/api/users", { method: "POST", body: JSON.stringify(input) })
}

export function updateUser(id: string, input: UserInput) {
  return apiFetch<ManagedUser>(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(input) })
}

export function resetUserPassword(id: string, password: string) {
  return apiFetch<void>(`/api/users/${id}/password`, { method: "PUT", body: JSON.stringify({ password }) })
}

export function setUserActive(id: string, isActive: boolean) {
  return apiFetch<ManagedUser>(`/api/users/${id}/active`, { method: "PUT", body: JSON.stringify({ isActive }) })
}

export function listRoles(signal?: AbortSignal) {
  return apiFetch<Role[]>("/api/roles", { signal })
}

export function createRole(input: RoleInput) {
  return apiFetch<Role>("/api/roles", { method: "POST", body: JSON.stringify(input) })
}

export function updateRole(id: string, input: RoleInput) {
  return apiFetch<Role>(`/api/roles/${id}`, { method: "PUT", body: JSON.stringify(input) })
}

export function deleteRole(id: string) {
  return apiFetch<void>(`/api/roles/${id}`, { method: "DELETE" })
}
