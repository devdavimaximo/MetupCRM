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

/** `bucketStart` é uma data local da organização ("2026-09-15") — nunca reconverter fuso ao formatar. */
export type RevenuePoint = { bucketStart: string; revenue: number; wonDeals: number; lostDeals: number }

/** `amount` é o valor efetivo (valor em negociação ou ticket); `estimatedCount` quantos vieram do ticket. */
export type PipelineStage = {
  stage: DealStage
  count: number
  amount: number
  estimatedCount: number
  stalledCount: number
}

/** Conversão histórica da etapa: dos que entraram nela, quantos seguiram adiante. */
export type StageAdvanceRate = {
  stage: DealStage
  enteredCount: number
  advancedCount: number
  advanceRate: number | null
  averageDaysInStage: number | null
}

export type FeaturedDeal = {
  id: string
  companyId: string
  companyName: string
  stage: DealStage
  amount: number | null
  isEstimated: boolean
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

/** O recorte de negócios do panorama. O servidor rebaixa o pedido que o papel não alcança. */
export type DealScope = "Organization" | "Mine"

export type DashboardOverview = {
  periodDays: number
  scope: DealScope
  periodStart: string
  periodEnd: string
  previousStart: string
  /** Datas locais (inclusive) do período — rotular sem reconverter fuso. */
  periodStartLocal: string
  periodEndLocal: string
  historyStart: string | null
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
  stageAdvanceRates: StageAdvanceRate[]
  weightedForecast: number | null
  openDealsWithoutAmount: number
  stalledAfterDays: number
  featuredDeals: FeaturedDeal[]
  recentEvents: RecentEvent[]
  sources: SourceBreakdown[]
  owners: OwnerPerformance[]
}

/**
 * A central de comando: últimos `days` dias ou o intervalo local `from`–`to` (inclusive), comparado à
 * janela anterior de mesmo tamanho, no escopo pedido — o servidor decide o que este papel alcança e
 * devolve em `scope` o recorte que de fato valeu.
 */
export function getDashboardOverview(
  period: { days: number } | { from: string; to: string },
  scope: DealScope,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({ scope })
  if ("days" in period) params.set("days", String(period.days))
  else {
    params.set("from", period.from)
    params.set("to", period.to)
  }
  return apiFetch<DashboardOverview>(`/api/dashboard/overview?${params}`, { signal })
}

/** A fotografia de hoje: sempre "minha", o servidor resolve organização e usuário pelo token. */
export function getDashboardSummary(signal?: AbortSignal) {
  return apiFetch<DashboardSummary>("/api/dashboard", { signal })
}
