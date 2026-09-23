import { apiFetch } from "@/lib/api"
import type { DealSource, DealStage } from "@/features/deals/api"
import type { LocalDate } from "@/lib/local-date"
import type { PeriodRequest } from "@/lib/period"

/** Um número do período e o mesmo número na janela anterior — a forma de comparação do produto. */
export type PeriodValue = { current: number; previous: number }

/**
 * A janela que o servidor aplicou e a anterior, que serve de base de comparação. `historyStart` é
 * o primeiro negócio da organização: antes dele não há com o que comparar, e a UI diz isso em vez
 * de inventar percentual.
 */
export type ReportPeriod = {
  days: number
  periodStart: string
  periodEnd: string
  previousStart: string
  periodStartLocal: LocalDate
  periodEndLocal: LocalDate
  historyStart: string | null
}

function buildQuery(request: PeriodRequest): string {
  const query = new URLSearchParams(
    "days" in request ? { days: String(request.days) } : { from: request.from, to: request.to }
  )
  return `?${query}`
}

/* ─── Funil ─────────────────────────────────────────────────────────────────── */

/** Uma etapa do funil em coorte: quantos dos que entraram no período chegaram até aqui. */
export type FunnelStep = {
  stage: DealStage
  reached: number
  value: number
  /** Passagem desde a etapa anterior. */
  stepRate: number | null
  /** Conversão desde o topo do funil. */
  topRate: number | null
  averageDays: number | null
}

export type DealsByStage = { stage: DealStage; count: number }

export type StageConversion = { fromStage: DealStage; toStage: DealStage; count: number }

export type GoldenMetric = {
  calls: PeriodValue
  closedRevenue: PeriodValue
  callsPerFiveThousand: number | null
  previousCallsPerFiveThousand: number | null
}

/** Quantos negócios fecharam em até `upToDays` dias; `null` no último balde é "daí para cima". */
export type DurationBucket = { upToDays: number | null; count: number }

export type TimeToClose = {
  wonDealsCount: number
  averageDaysToClose: number | null
  previousAverageDaysToClose: number | null
  distribution: DurationBucket[]
}

export type FunnelReport = {
  period: ReportPeriod
  funnel: FunnelStep[]
  cohortSize: number
  lostCount: number
  cohortConversionRate: number | null
  previousCohortConversionRate: number | null
  dealsByStage: DealsByStage[]
  stageConversions: StageConversion[]
  goldenMetric: GoldenMetric
  timeToClose: TimeToClose
}

/** O funil do período: a coorte que entrou, até onde chegou, o tempo até fechar e a métrica de ouro. */
export function getFunnelReport(request: PeriodRequest, signal?: AbortSignal) {
  return apiFetch<FunnelReport>(`/api/reports/funnel${buildQuery(request)}`, { signal })
}

/* ─── Desempenho (responsável, segmento, origem) ────────────────────────────── */

export type SalesPerformanceGroup = {
  groupKey: string
  groupLabel: string
  openDeals: number
  openAmount: number
  wonDeals: number
  lostDeals: number
  closeRate: number | null
  averageTicket: number | null
  totalRevenue: number
  previousWonDeals: number
  previousRevenue: number
  previousCloseRate: number | null
}

export type SalesPerformanceTotals = {
  groups: number
  openDeals: number
  openAmount: number
  wonDeals: number
  lostDeals: number
  closeRate: number | null
  averageTicket: number | null
  revenue: PeriodValue
}

export type SalesPerformanceReport = {
  period: ReportPeriod
  groups: SalesPerformanceGroup[]
  totals: SalesPerformanceTotals
}

/** Os três eixos de desempenho — mesma forma de dados, só muda o agrupamento. */
export type PerformanceAxis = "owner" | "segment" | "source"

const PERFORMANCE_PATHS: Record<PerformanceAxis, string> = {
  owner: "sales-by-owner",
  segment: "sales-by-segment",
  source: "sales-by-source",
}

export function getSalesPerformance(axis: PerformanceAxis, request: PeriodRequest, signal?: AbortSignal) {
  return apiFetch<SalesPerformanceReport>(`/api/reports/${PERFORMANCE_PATHS[axis]}${buildQuery(request)}`, { signal })
}

/* ─── Safras ────────────────────────────────────────────────────────────────── */

/** `cohortKey` sai como "yyyy-MM" (ordenável); o rótulo de exibição é formatado na UI. */
export type CohortGroup = {
  cohortKey: string
  totalDeals: number
  openDeals: number
  wonDeals: number
  lostDeals: number
  closeRate: number | null
  averageTicket: number | null
  totalRevenue: number
  averageDaysToClose: number | null
}

export type CohortReport = { period: ReportPeriod; cohorts: CohortGroup[] }

export function getCohortReport(request: PeriodRequest, signal?: AbortSignal) {
  return apiFetch<CohortReport>(`/api/reports/cohorts${buildQuery(request)}`, { signal })
}

/* ─── Forecast ──────────────────────────────────────────────────────────────── */

/**
 * `winProbability` e `weightedAmount` vêm nulos quando não há histórico de negócios fechados que
 * passaram pelo estágio — o back-end não inventa probabilidade sem base.
 */
export type ForecastByStage = {
  stage: DealStage
  openDealsCount: number
  openAmount: number
  winProbability: number | null
  weightedAmount: number | null
}

/** `monthKey` nulo é o balde dos negócios sem previsão de fechamento preenchida. */
export type ForecastMonth = {
  monthKey: string | null
  isOverdue: boolean
  openDealsCount: number
  openAmount: number
  weightedAmount: number | null
}

export type ForecastReport = {
  period: ReportPeriod
  byStage: ForecastByStage[]
  byMonth: ForecastMonth[]
  totalOpenDeals: number
  totalPipelineAmount: number
  totalWeightedForecast: number
  openDealsWithoutExpectedCloseDate: number
}

/** Fotografia do pipeline aberto hoje, ponderada pela probabilidade histórica de cada estágio. */
export function getForecastReport(request: PeriodRequest, signal?: AbortSignal) {
  return apiFetch<ForecastReport>(`/api/reports/forecast${buildQuery(request)}`, { signal })
}

export type { DealSource }
