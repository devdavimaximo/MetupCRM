import { createPeriodStore, periodPresetOptions, type Period } from "@/lib/period"

export type { Period as ReportsPeriod } from "@/lib/period"

/**
 * Relatório é análise, não fotografia do dia: os atalhos começam em 30 dias e vão até 12 meses —
 * safra mensal e comparação entre semestres precisam de janela larga. O padrão é semestral, igual
 * ao do servidor (`IReportPeriodRequest.DefaultDays`).
 */
export const reportPeriodPresets = periodPresetOptions(["30d", "mes-atual", "mes-anterior", "3m", "6m", "12m"])

export const DEFAULT_REPORTS_PERIOD: Period = { kind: "preset", preset: "6m" }

const store = createPeriodStore({ storageKey: "metup.reports.period", defaultPeriod: DEFAULT_REPORTS_PERIOD })

export function readInitialReportsPeriod(url: { reportPeriod: string; reportFrom: string; reportTo: string }): Period {
  return store.readInitial({ preset: url.reportPeriod, from: url.reportFrom, to: url.reportTo })
}

export const storeReportsPeriod = store.store

export function reportsPeriodUrlPatch(period: Period) {
  const { preset, from, to } = store.urlValues(period)
  return { reportPeriod: preset, reportFrom: from, reportTo: to }
}
