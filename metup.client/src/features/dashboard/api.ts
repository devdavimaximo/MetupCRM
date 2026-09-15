import { apiFetch } from "@/lib/api"
import type { ActivityOutcome, ActivityType } from "@/features/activities/api"
import type { DealSource, DealStage } from "@/features/deals/api"
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
  nextTasks: TaskItem[]
  openDealsByStage: DealsByStage[]
  openDealsTotal: number
  activitiesToday: ActivitiesByType[]
  activitiesTodayTotal: number
}

export type PeriodValue = { current: number; previous: number }

export type RevenuePoint = { bucketStart: string; revenue: number; wonDeals: number; lostDeals: number }

export type PipelineStage = { stage: DealStage; count: number; amount: number; stalledCount: number }

export type FeaturedDeal = {
  id: string
  companyName: string
  stage: DealStage
  amount: number | null
  ownerUserName: string
  daysInStage: number
  nextTaskDueDate: string | null
  nextTaskType: ActivityType | null
}

export type RecentEventKind = "DealCreated" | "StageAdvanced" | "DealWon" | "DealLost" | "Activity"

export type RecentEvent = {
  kind: RecentEventKind
  dealId: string
  companyName: string
  actorName: string
  occurredAt: string
  toStage: DealStage | null
  activityType: ActivityType | null
  outcome: ActivityOutcome | null
  amount: number | null
}

export type SourceBreakdown = { source: DealSource; newDeals: number; wonDeals: number; revenue: number }

export type OwnerPerformance = {
  ownerUserId: string
  ownerUserName: string
  wonDeals: number
  revenue: number
  openDeals: number
  openAmount: number
}

export type DashboardOverview = {
  periodDays: number
  periodStart: string
  periodEnd: string
  revenue: PeriodValue
  wonDeals: PeriodValue
  lostDeals: PeriodValue
  newDeals: PeriodValue
  proposalsSent: PeriodValue
  meetingsHeld: PeriodValue
  callsMade: PeriodValue
  revenueSeries: RevenuePoint[]
  seriesGranularity: "day" | "week"
  pipeline: PipelineStage[]
  openDealsWithoutAmount: number
  stalledAfterDays: number
  featuredDeals: FeaturedDeal[]
  recentEvents: RecentEvent[]
  sources: SourceBreakdown[]
  owners: OwnerPerformance[]
}

/** A central de comando: organização inteira, janela de `days` dias comparada à anterior. */
export function getDashboardOverview(days: number, signal?: AbortSignal) {
  return apiFetch<DashboardOverview>(`/api/dashboard/overview?days=${days}`, { signal })
}

/** A fotografia de hoje: sempre "minha", o servidor resolve organização e usuário pelo token. */
export function getDashboardSummary(signal?: AbortSignal) {
  return apiFetch<DashboardSummary>("/api/dashboard", { signal })
}
