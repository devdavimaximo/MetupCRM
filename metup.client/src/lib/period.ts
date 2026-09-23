import { addMonths, daysInclusive, endOfMonth, formatLocalRange, isLocalDate, startOfMonth, type LocalDate } from "@/lib/local-date"

/** Mesmo teto do servidor (`LocalPeriod.MaxDays`). */
export const MAX_PERIOD_DAYS = 366

export type PeriodPresetId = "hoje" | "7d" | "30d" | "mes-atual" | "mes-anterior" | "3m" | "6m" | "12m"

export type Period = { kind: "preset"; preset: PeriodPresetId } | { kind: "custom"; from: LocalDate; to: LocalDate }

/** O que vai para a API: janela móvel em dias (o servidor ancora em "hoje" no fuso da organização) ou datas. */
export type PeriodRequest = { days: number } | { from: LocalDate; to: LocalDate }

type PresetDefinition = {
  id: PeriodPresetId
  label: string
  /** Como o período aparece no meio de uma frase ou rótulo curto: "Ganhos · 30 dias". */
  short: string
  resolve: (today: LocalDate) => PeriodRequest
}

/**
 * Os atalhos de período do produto inteiro. Cada tela escolhe quais oferece
 * ({@link periodPresetOptions}), mas nenhuma inventa um atalho próprio: "últimos 3 meses" significa
 * a mesma coisa no dashboard, no pipeline e nos relatórios.
 */
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
  { id: "12m", label: "Últimos 12 meses", short: "12 meses", resolve: () => ({ days: 365 }) },
]

const presetById = new Map(PRESETS.map((p) => [p.id, p]))

/** Os atalhos que uma tela oferece, na ordem pedida. */
export function periodPresetOptions(ids: PeriodPresetId[]) {
  return ids.map((id) => ({ id, label: presetById.get(id)!.label }))
}

export function isPresetId(value: string | null | undefined): value is PeriodPresetId {
  return presetById.has(value as PeriodPresetId)
}

export function resolvePeriod(period: Period, today: LocalDate): PeriodRequest {
  return period.kind === "custom" ? { from: period.from, to: period.to } : presetById.get(period.preset)!.resolve(today)
}

/** Nome do período para o gatilho e para frases: "Últimos 30 dias" ou "16 ago – 15 set 2026". */
export function periodLabel(period: Period) {
  return period.kind === "custom" ? formatLocalRange(period.from, period.to) : presetById.get(period.preset)!.label
}

/** Rótulo curto para espaços apertados ("30 dias", "mês anterior"); intervalo manual vira "período". */
export function periodShortLabel(period: Period) {
  return period.kind === "custom" ? "período" : presetById.get(period.preset)!.short
}

export function isValidCustomRange(from: string, to: string) {
  return isLocalDate(from) && isLocalDate(to) && from <= to && daysInclusive(from, to) <= MAX_PERIOD_DAYS
}

/** O período como ele viaja na URL de uma tela: um atalho, ou um par de datas. */
export type PeriodUrlValues = { preset: string; from: string; to: string }

type PeriodStoreOptions = {
  /** Chave no localStorage — uma por tela: o período do dashboard não é o dos relatórios. */
  storageKey: string
  defaultPeriod: Period
  /** Valores antigos ainda salvos no navegador de quem já usava a tela. */
  legacy?: Record<string, PeriodPresetId>
}

/**
 * Leitura e persistência do período de uma tela: URL primeiro (o link compartilhado manda), depois
 * a última escolha salva, depois o padrão. O intervalo manual não é salvo — é contexto de um link,
 * não preferência.
 */
export function createPeriodStore({ storageKey, defaultPeriod, legacy = {} }: PeriodStoreOptions) {
  function readInitial(url: PeriodUrlValues): Period {
    if (url.from && url.to && isValidCustomRange(url.from, url.to)) {
      return { kind: "custom", from: url.from, to: url.to }
    }
    if (isPresetId(url.preset)) return { kind: "preset", preset: url.preset }

    try {
      const stored = localStorage.getItem(storageKey) ?? ""
      const preset = isPresetId(stored) ? stored : legacy[stored]
      if (preset) return { kind: "preset", preset }
    } catch {
      /* sem storage, fica o padrão */
    }
    return defaultPeriod
  }

  function store(period: Period) {
    if (period.kind !== "preset") return
    try {
      localStorage.setItem(storageKey, period.preset)
    } catch {
      /* conveniência — sem storage, só não lembra */
    }
  }

  function urlValues(period: Period): PeriodUrlValues {
    return period.kind === "custom"
      ? { preset: "", from: period.from, to: period.to }
      : { preset: period.preset, from: "", to: "" }
  }

  return { readInitial, store, urlValues, defaultPeriod }
}
