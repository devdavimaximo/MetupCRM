import {
  addMonths,
  daysInclusive,
  endOfMonth,
  formatLocalRange,
  isLocalDate,
  startOfMonth,
  type LocalDate,
} from "@/lib/local-date"

/** Mesmo teto do validador do overview. */
export const MAX_PERIOD_DAYS = 366

export type PeriodPresetId = "hoje" | "7d" | "30d" | "mes-atual" | "mes-anterior" | "3m" | "6m"

export type DashboardPeriod =
  | { kind: "preset"; preset: PeriodPresetId }
  | { kind: "custom"; from: LocalDate; to: LocalDate }

/** O que vai para a API: janela móvel em dias (o servidor ancora em "hoje" no fuso da organização) ou datas. */
export type PeriodRequest = { days: number } | { from: LocalDate; to: LocalDate }

type PresetDefinition = {
  id: PeriodPresetId
  label: string
  /** Como o período aparece no meio de uma frase ou rótulo curto: "Ganhos · 30 dias". */
  short: string
  resolve: (today: LocalDate) => PeriodRequest
}

const PRESETS: PresetDefinition[] = [
  { id: "hoje", label: "Hoje", short: "hoje", resolve: () => ({ days: 1 }) },
  { id: "7d", label: "Últimos 7 dias", short: "7 dias", resolve: () => ({ days: 7 }) },
  { id: "30d", label: "Últimos 30 dias", short: "30 dias", resolve: () => ({ days: 30 }) },
  {
    id: "mes-atual",
    label: "Mês atual",
    short: "mês atual",
    resolve: (today) => ({ from: startOfMonth(today), to: today }),
  },
  {
    id: "mes-anterior",
    label: "Mês anterior",
    short: "mês anterior",
    resolve: (today) => {
      const previous = addMonths(startOfMonth(today), -1)
      return { from: previous, to: endOfMonth(previous) }
    },
  },
  { id: "3m", label: "Últimos 3 meses", short: "3 meses", resolve: () => ({ days: 90 }) },
  { id: "6m", label: "Últimos 6 meses", short: "6 meses", resolve: () => ({ days: 180 }) },
]

const presetById = new Map(PRESETS.map((p) => [p.id, p]))

export const periodPresets = PRESETS.map(({ id, label }) => ({ id, label }))

export const DEFAULT_PERIOD: DashboardPeriod = { kind: "preset", preset: "30d" }

export function isPresetId(value: string | null | undefined): value is PeriodPresetId {
  return presetById.has(value as PeriodPresetId)
}

export function resolvePeriod(period: DashboardPeriod, today: LocalDate): PeriodRequest {
  return period.kind === "custom" ? { from: period.from, to: period.to } : presetById.get(period.preset)!.resolve(today)
}

/** Nome do período para o gatilho e para frases: "Últimos 30 dias" ou "16 ago – 15 set 2026". */
export function periodLabel(period: DashboardPeriod) {
  return period.kind === "custom" ? formatLocalRange(period.from, period.to) : presetById.get(period.preset)!.label
}

/** Rótulo curto para espaços apertados ("30 dias", "mês anterior"); intervalo manual vira "período". */
export function periodShortLabel(period: DashboardPeriod) {
  return period.kind === "custom" ? "período" : presetById.get(period.preset)!.short
}

const PERIOD_STORAGE_KEY = "metup.dashboard.period"

/** Valores do `<select>` antigo, ainda salvos no navegador de quem já usava o dashboard. */
const LEGACY_STORED: Record<string, PeriodPresetId> = { "7": "7d", "30": "30d", "90": "3m", "180": "6m" }

function isValidCustom(from: string, to: string) {
  return isLocalDate(from) && isLocalDate(to) && from <= to && daysInclusive(from, to) <= MAX_PERIOD_DAYS
}

/** URL primeiro (link compartilhado), depois a última escolha salva, depois 30 dias. */
export function readInitialPeriod(url: { dashboardPeriod: string; dashboardFrom: string; dashboardTo: string }): DashboardPeriod {
  if (url.dashboardFrom && url.dashboardTo && isValidCustom(url.dashboardFrom, url.dashboardTo)) {
    return { kind: "custom", from: url.dashboardFrom, to: url.dashboardTo }
  }
  if (isPresetId(url.dashboardPeriod)) return { kind: "preset", preset: url.dashboardPeriod }

  try {
    const stored = localStorage.getItem(PERIOD_STORAGE_KEY) ?? ""
    const preset = isPresetId(stored) ? stored : LEGACY_STORED[stored]
    if (preset) return { kind: "preset", preset }
  } catch {
    /* sem storage, fica o padrão */
  }
  return DEFAULT_PERIOD
}

/** Atalho lembra no navegador; intervalo manual só vive na URL (é contexto de um link, não preferência). */
export function storePeriod(period: DashboardPeriod) {
  if (period.kind !== "preset") return
  try {
    localStorage.setItem(PERIOD_STORAGE_KEY, period.preset)
  } catch {
    /* conveniência — sem storage, só não lembra */
  }
}

export function periodUrlPatch(period: DashboardPeriod) {
  return period.kind === "custom"
    ? { dashboardPeriod: "", dashboardFrom: period.from, dashboardTo: period.to }
    : { dashboardPeriod: period.preset, dashboardFrom: "", dashboardTo: "" }
}
