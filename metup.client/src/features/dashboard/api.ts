import { apiFetch } from "@/lib/api"
import type { ActivityType } from "@/features/activities/api"
import type { DealStage } from "@/features/deals/api"
import type { TaskItem } from "@/features/tasks/api"

export type TaskCounts = {
  overdue: number
  today: number
  upcoming: number
}

export type DealsByStage = {
  stage: DealStage
  count: number
}

export type ActivitiesByType = {
  type: ActivityType
  count: number
}

export type DashboardSummary = {
  taskCounts: TaskCounts
  todayTasks: TaskItem[]
  openDealsByStage: DealsByStage[]
  openDealsTotal: number
  activitiesToday: ActivitiesByType[]
  activitiesTodayTotal: number
}

/** A fotografia de hoje: sempre "minha", o servidor resolve organização e usuário pelo token. */
export function getDashboardSummary(signal?: AbortSignal) {
  return apiFetch<DashboardSummary>("/api/dashboard", { signal })
}
