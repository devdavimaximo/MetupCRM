import {
  createPeriodStore,
  periodPresetOptions,
  type Period,
  type PeriodPresetId,
  type PeriodRequest,
} from "@/lib/period"

export { MAX_PERIOD_DAYS, isPresetId, periodLabel, periodShortLabel, resolvePeriod } from "@/lib/period"
export type { PeriodPresetId, PeriodRequest }

/** O período do dashboard é o período do produto (`lib/period`) — aqui só se escolhe o que ele oferece e onde guarda. */
export type DashboardPeriod = Period

/** O dashboard responde "como estamos agora": os atalhos param em 6 meses. */
export const periodPresets = periodPresetOptions(["hoje", "7d", "30d", "mes-atual", "mes-anterior", "3m", "6m"])

export const DEFAULT_PERIOD: DashboardPeriod = { kind: "preset", preset: "30d" }

/** Valores do `<select>` antigo, ainda salvos no navegador de quem já usava o dashboard. */
const LEGACY_STORED: Record<string, PeriodPresetId> = { "7": "7d", "30": "30d", "90": "3m", "180": "6m" }

const store = createPeriodStore({
  storageKey: "metup.dashboard.period",
  defaultPeriod: DEFAULT_PERIOD,
  legacy: LEGACY_STORED,
})

export function readInitialPeriod(url: { dashboardPeriod: string; dashboardFrom: string; dashboardTo: string }): DashboardPeriod {
  return store.readInitial({ preset: url.dashboardPeriod, from: url.dashboardFrom, to: url.dashboardTo })
}

export const storePeriod = store.store

export function periodUrlPatch(period: DashboardPeriod) {
  const { preset, from, to } = store.urlValues(period)
  return { dashboardPeriod: preset, dashboardFrom: from, dashboardTo: to }
}
