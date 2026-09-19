import { apiFetch } from "@/lib/api"
import type { ActivityType } from "@/features/activities/api"
import type { DealStage } from "@/features/deals/api"

export type TaskStatus = "Pendente" | "Concluida" | "Cancelada"

/** Recortes de prazo calculados no servidor, no fuso da organização. */
export type TaskScope = "All" | "Overdue" | "Today" | "ThisWeek" | "Later"

export type TaskSort = "DueAsc" | "DueDesc" | "Recent" | "Owner" | "Status"

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
  dealStage: DealStage
  /** Negócio aberto: valor efetivo (valor em negociação ou ticket). Fechado: o valor fechado. */
  dealAmount: number | null
  /** O valor veio do ticket estimado. */
  dealAmountIsEstimated: boolean
  contactName: string | null
}

export type PagedResult<T> = {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export type ListTasksParams = {
  ownerUserId?: string
  /** "Todos os responsáveis" — só Admin/Closer (403 para SDR). */
  allOwners?: boolean
  /** Legado (TasksPage atual): status único + intervalo, sem `scope`. */
  status?: TaskStatus
  dueFrom?: string
  dueTo?: string
  scope?: TaskScope
  /** Dia local da organização, `YYYY-MM-DD`. */
  referenceDate?: string
  statuses?: TaskStatus[]
  types?: ActivityType[]
  dealStages?: DealStage[]
  search?: string
  sort?: TaskSort
  page?: number
  pageSize?: number
}

/** Sem ownerUserId = "minhas tarefas" (o servidor resolve pelo token). */
export function listTasks(params: ListTasksParams, signal?: AbortSignal) {
  const query = new URLSearchParams()
  if (params.ownerUserId) query.set("ownerUserId", params.ownerUserId)
  if (params.allOwners) query.set("allOwners", "true")
  if (params.status) query.set("status", params.status)
  if (params.dueFrom) query.set("dueFrom", params.dueFrom)
  if (params.dueTo) query.set("dueTo", params.dueTo)
  if (params.scope) query.set("scope", params.scope)
  if (params.referenceDate) query.set("referenceDate", params.referenceDate)
  params.statuses?.forEach((status) => query.append("statuses", status))
  params.types?.forEach((type) => query.append("types", type))
  params.dealStages?.forEach((stage) => query.append("dealStages", stage))
  if (params.search) query.set("search", params.search)
  if (params.sort) query.set("sort", params.sort)
  query.set("page", String(params.page ?? 1))
  query.set("pageSize", String(params.pageSize ?? 100))

  return apiFetch<PagedResult<TaskItem>>(`/api/tasks?${query}`, { signal })
}

export type TaskSummary = {
  referenceDate: string
  /** Cada número é o `totalCount` da listagem no recorte correspondente. */
  counts: {
    all: number
    overdue: number
    today: number
    thisWeek: number
    later: number
    completed30d: number
    cancelled30d: number
  }
  /** Mesma régua 7 dias antes; `null` = "Sem base anterior". */
  previous: { overdue: number; today: number; thisWeek: number } | null
  /** 14 dias locais terminando na referência, um ponto por dia. */
  weeklyCompleted: { date: string; count: number }[]
  completedThisWeek: number
  completedPreviousWeek: number
  completedChangePct: number | null
}

export function getTaskSummary(
  params: { ownerUserId?: string; allOwners?: boolean; referenceDate?: string },
  signal?: AbortSignal
) {
  const query = new URLSearchParams()
  if (params.ownerUserId) query.set("ownerUserId", params.ownerUserId)
  if (params.allOwners) query.set("allOwners", "true")
  if (params.referenceDate) query.set("referenceDate", params.referenceDate)

  return apiFetch<TaskSummary>(`/api/tasks/summary?${query}`, { signal })
}

export type CreateTaskInput = {
  dealId: string
  type: ActivityType
  dueDate: string
  /** Sem valor = o usuário logado; outro só Admin/Closer. */
  ownerUserId?: string
  note?: string
}

export function createTask(input: CreateTaskInput) {
  return apiFetch<TaskItem>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  })
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

/** Só Admin/Closer (403 para SDR). */
export function reassignTask(id: string, ownerUserId: string) {
  return apiFetch<TaskItem>(`/api/tasks/${id}/reassign`, {
    method: "POST",
    body: JSON.stringify({ ownerUserId }),
  })
}

export type BulkTaskAction = "Complete" | "Cancel" | "Reschedule" | "Reassign"

/** `NotFound` também cobre tarefa fora do escopo do usuário (o servidor não revela a existência). */
export type BulkTaskFailureReason = "NotFound" | "NotPending"

export type BulkTaskResult = {
  succeeded: TaskItem[]
  failed: { id: string; reason: BulkTaskFailureReason }[]
}

export const BULK_TASK_LIMIT = 100

export function bulkTasks(input: { ids: string[]; action: BulkTaskAction; dueDate?: string; ownerUserId?: string }) {
  return apiFetch<BulkTaskResult>("/api/tasks/bulk", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

/** Um dia do mês com tarefa pendente; `overdue` ≤ `open`. */
export type TaskCalendarDay = { date: string; open: number; overdue: number }

export function getTaskCalendar(
  params: { month: string; ownerUserId?: string; allOwners?: boolean },
  signal?: AbortSignal
) {
  const query = new URLSearchParams({ month: params.month })
  if (params.ownerUserId) query.set("ownerUserId", params.ownerUserId)
  if (params.allOwners) query.set("allOwners", "true")

  return apiFetch<TaskCalendarDay[]>(`/api/tasks/calendar?${query}`, { signal })
}
