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

export type SalesPerformanceByOwner = {
  ownerUserId: string
  ownerName: string
  openDeals: number
  wonDeals: number
  lostDeals: number
  closeRate: number | null
  averageTicket: number | null
  totalRevenue: number
}

export type SalesPerformanceReport = {
  byOwner: SalesPerformanceByOwner[]
}

/** Conversão e ticket médio por responsável (V3, segunda fatia) — sem from/to, considera todo o histórico da organização. */
export function getSalesPerformanceByOwner(params: { from?: string; to?: string }, signal?: AbortSignal) {
  const query = new URLSearchParams()
  if (params.from) query.set("from", params.from)
  if (params.to) query.set("to", params.to)

  const suffix = query.toString()
  return apiFetch<SalesPerformanceReport>(`/api/reports/sales-by-owner${suffix ? `?${suffix}` : ""}`, { signal })
}
