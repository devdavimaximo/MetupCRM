import { apiFetch } from "@/lib/api"
import type { ActivityType } from "@/features/activities/api"

export type TaskStatus = "Pendente" | "Concluida" | "Cancelada"

export type TaskItem = {
  id: string
  dealId: string
  companyId: string
  companyName: string
  type: ActivityType
  dueDate: string
  ownerUserId: string
  ownerUserName: string
  note: string | null
  status: TaskStatus
  createdAt: string
  completedAt: string | null
}

export type PagedResult<T> = {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

/** Sem ownerUserId = "minhas tarefas" (o servidor resolve pelo token). */
export function listTasks(
  params: { ownerUserId?: string; status?: TaskStatus; dueFrom?: string; dueTo?: string; page?: number; pageSize?: number },
  signal?: AbortSignal
) {
  const query = new URLSearchParams()
  if (params.ownerUserId) query.set("ownerUserId", params.ownerUserId)
  if (params.status) query.set("status", params.status)
  if (params.dueFrom) query.set("dueFrom", params.dueFrom)
  if (params.dueTo) query.set("dueTo", params.dueTo)
  query.set("page", String(params.page ?? 1))
  query.set("pageSize", String(params.pageSize ?? 100))

  return apiFetch<PagedResult<TaskItem>>(`/api/tasks?${query}`, { signal })
}

export function completeTask(id: string) {
  return apiFetch<TaskItem>(`/api/tasks/${id}/complete`, { method: "POST" })
}

export function cancelTask(id: string) {
  return apiFetch<TaskItem>(`/api/tasks/${id}/cancel`, { method: "POST" })
}

export function rescheduleTask(id: string, dueDate: string) {
  return apiFetch<TaskItem>(`/api/tasks/${id}/reschedule`, {
    method: "POST",
    body: JSON.stringify({ dueDate }),
  })
}
