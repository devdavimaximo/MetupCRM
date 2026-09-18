import { apiFetch } from "@/lib/api"
import type { ActivityOutcome, ActivityType } from "@/features/activities/api"
import type { DealSource, DealStage } from "@/features/deals/api"
import type { TaskItem } from "@/features/tasks/api"

export type TaskCounts = {
  overdue: number
  today: number
  upcoming: number
}

/** A fotografia de hoje: só o que a tela usa. Funil, origens e números do período vêm do overview. */
export type DashboardSummary = {
  taskCounts: TaskCounts
  nextTasks: TaskItem[]
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
  /** Data local da organização ("2026-10-01"). */
  expectedCloseDate: string | null
}

/**
 * Previsão de fechamento: janela de hoje (`windowStartLocal`, que é o "hoje" da organização) até
 * `windowEndLocal`, inclusive, com a duração do período, para a frente. `openDealsWithExpectedCloseDate`
 * = 0 quer dizer que ninguém preencheu previsão.
 */
export type ExpectedClose = {
  windowStartLocal: string
  windowEndLocal: string
  expectedToCloseAmount: number
  expectedToCloseCount: number
  overdueExpectedCount: number
  openDealsWithExpectedCloseDate: number
}

export type RecentEventKind = "DealCreated" | "StageAdvanced" | "DealWon" | "DealLost" | "Activity"

/** Uma linha do feed da operação. `id` é o da atividade ou da transição, estável entre páginas. */
export type RecentEvent = {
  id: string
  kind: RecentEventKind
  dealId: string
  companyName: string
  actorName: string
  occurredAt: string
  /** Dia de `occurredAt` no fuso da organização ("2026-09-15") — agrupar por ele, nunca reconverter fuso. */
  occurredOnLocal: string
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
  expectedClose: ExpectedClose
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

/** Filtros do feed: tipos de transição de estágio e, depois, tipos de atividade. Vazio = tudo. */
export type ActivityFeedFilter =
  | "DealCreated"
  | "StageAdvanced"
  | "DealWon"
  | "DealLost"
  | "Call"
  | "WhatsApp"
  | "Meeting"
  | "Proposal"
  | "Note"

/** `nextCursor` nulo = fim do feed. */
export type ActivityFeedPage = { items: RecentEvent[]; nextCursor: string | null }

/**
 * O feed completo, do mais recente para trás, sem depender do período do dashboard. O servidor aplica
 * o escopo do papel: para o SDR, `ownerUserId` é ignorado.
 */
export function listActivityFeed(
  params: { cursor?: string | null; kinds?: ActivityFeedFilter[]; ownerUserId?: string; pageSize?: number },
  signal?: AbortSignal
) {
  const query = new URLSearchParams()
  if (params.cursor) query.set("cursor", params.cursor)
  if (params.kinds?.length) query.set("kinds", params.kinds.join(","))
  if (params.ownerUserId) query.set("ownerUserId", params.ownerUserId)
  if (params.pageSize) query.set("pageSize", String(params.pageSize))
  const suffix = query.toString()
  return apiFetch<ActivityFeedPage>(`/api/activity-feed${suffix ? `?${suffix}` : ""}`, { signal })
}

/** A fotografia de hoje: sempre "minha", o servidor resolve organização e usuário pelo token. */
export function getDashboardSummary(signal?: AbortSignal) {
  return apiFetch<DashboardSummary>("/api/dashboard", { signal })
}
