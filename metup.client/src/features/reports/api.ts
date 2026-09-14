import { apiFetch } from "@/lib/api"
import type { DealStage } from "@/features/deals/api"

export type DealsByStage = {
  stage: DealStage
  count: number
}

export type StageConversion = {
  fromStage: DealStage
  toStage: DealStage
  count: number
}

export type StageDuration = {
  stage: DealStage
  averageDays: number
}

export type GoldenMetric = {
  callsCount: number
  closedRevenue: number
  callsPerFiveThousand: number | null
}

export type FunnelReport = {
  dealsByStage: DealsByStage[]
  stageConversions: StageConversion[]
  averageDaysInStage: StageDuration[]
  goldenMetric: GoldenMetric
}

/** Funil histórico completo (V3, primeira fatia) — sem from/to, considera todo o histórico da organização. */
export function getFunnelReport(params: { from?: string; to?: string }, signal?: AbortSignal) {
  const query = new URLSearchParams()
  if (params.from) query.set("from", params.from)
  if (params.to) query.set("to", params.to)

  const suffix = query.toString()
  return apiFetch<FunnelReport>(`/api/reports/funnel${suffix ? `?${suffix}` : ""}`, { signal })
}

/** Desempenho de um grupo (responsável, segmento ou origem) — mesma forma para as três quebras (V3). */
export type SalesPerformanceGroup = {
  groupKey: string
  groupLabel: string
  openDeals: number
  wonDeals: number
  lostDeals: number
  closeRate: number | null
  averageTicket: number | null
  totalRevenue: number
}

export type SalesPerformanceReport = {
  groups: SalesPerformanceGroup[]
}

function buildQuery(params: { from?: string; to?: string }): string {
  const query = new URLSearchParams()
  if (params.from) query.set("from", params.from)
  if (params.to) query.set("to", params.to)

  const suffix = query.toString()
  return suffix ? `?${suffix}` : ""
}

/** Conversão e ticket médio por responsável (V3, segunda fatia) — sem from/to, considera todo o histórico da organização. */
export function getSalesPerformanceByOwner(params: { from?: string; to?: string }, signal?: AbortSignal) {
  return apiFetch<SalesPerformanceReport>(`/api/reports/sales-by-owner${buildQuery(params)}`, { signal })
}

/** Conversão e ticket médio por segmento de empresa (V3, terceira fatia) — sem from/to, considera todo o histórico da organização. */
export function getSalesPerformanceBySegment(params: { from?: string; to?: string }, signal?: AbortSignal) {
  return apiFetch<SalesPerformanceReport>(`/api/reports/sales-by-segment${buildQuery(params)}`, { signal })
}

/** Conversão e ticket médio por origem do negócio (V3, terceira fatia) — sem from/to, considera todo o histórico da organização. */
export function getSalesPerformanceBySource(params: { from?: string; to?: string }, signal?: AbortSignal) {
  return apiFetch<SalesPerformanceReport>(`/api/reports/sales-by-source${buildQuery(params)}`, { signal })
}

/** Tempo ponta a ponta do funil (V3, quarta fatia): dias entre criação e fechamento como ganho. */
export type TimeToCloseReport = {
  wonDealsCount: number
  averageDaysToClose: number | null
}

/** Tempo médio até fechamento (V3, quarta fatia) — sem from/to, considera todo o histórico da organização. */
export function getTimeToCloseReport(params: { from?: string; to?: string }, signal?: AbortSignal) {
  return apiFetch<TimeToCloseReport>(`/api/reports/time-to-close${buildQuery(params)}`, { signal })
}

/**
 * Safra (cohort) de negócios pelo mês de entrada no funil (V3, sétima fatia) — corte temporal e
 * comparativo entre safras, diferente das quebras por responsável/segmento/origem. `cohortKey` sai
 * como "yyyy-MM" (ordenável); o rótulo de exibição é formatado na UI.
 */
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

export type CohortReport = {
  cohorts: CohortGroup[]
}

/** Safras de negócios por mês de criação (V3, sétima fatia) — sem from/to, considera todo o histórico da organização. */
export function getCohortReport(params: { from?: string; to?: string }, signal?: AbortSignal) {
  return apiFetch<CohortReport>(`/api/reports/cohorts${buildQuery(params)}`, { signal })
}
