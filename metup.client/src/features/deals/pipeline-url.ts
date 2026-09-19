import type { OwnerFilter } from "@/components/OwnerPicker"
import {
  addDays,
  addMonths,
  daysInclusive,
  endOfMonth,
  formatLocalRange,
  isLocalDate,
  startOfMonth,
  type LocalDate,
} from "@/lib/local-date"
import type { DealBoardClosedGroup, DealBoardSort, DealSource } from "./api"
import { sourceLabels } from "./stage-labels"

/* ─── Período (só vale para Fechados) ─────────────────────────────────────── */

export type PipelinePresetId = "mes-atual" | "30d" | "mes-anterior" | "trimestre"

export type PipelinePeriodChoice =
  | { kind: "preset"; preset: PipelinePresetId }
  | { kind: "custom"; from: LocalDate; to: LocalDate }

/** Mesmo teto do servidor (`LocalPeriodRules`). */
export const MAX_PIPELINE_PERIOD_DAYS = 366

const PRESETS: { id: PipelinePresetId; label: string; resolve: (today: LocalDate) => { from: LocalDate; to: LocalDate } }[] = [
  { id: "mes-atual", label: "Este mês", resolve: (today) => ({ from: startOfMonth(today), to: today }) },
  { id: "30d", label: "Últimos 30 dias", resolve: (today) => ({ from: addDays(today, -29), to: today }) },
  {
    id: "mes-anterior",
    label: "Mês anterior",
    resolve: (today) => {
      const previous = addMonths(startOfMonth(today), -1)
      return { from: previous, to: endOfMonth(previous) }
    },
  },
  {
    id: "trimestre",
    label: "Trimestre",
    resolve: (today) => {
      const month = Number(today.slice(5, 7))
      const firstMonth = String(month - ((month - 1) % 3)).padStart(2, "0")
      return { from: `${today.slice(0, 4)}-${firstMonth}-01`, to: today }
    },
  },
]

export const pipelinePeriodPresets = PRESETS.map(({ id, label }) => ({ id, label }))

export const DEFAULT_PIPELINE_PERIOD: PipelinePeriodChoice = { kind: "preset", preset: "30d" }

export function isPipelinePreset(value: string): value is PipelinePresetId {
  return PRESETS.some((p) => p.id === value)
}

/** As datas locais que vão para a API (`from`/`to`, inclusive). */
export function resolvePipelinePeriod(period: PipelinePeriodChoice, today: LocalDate) {
  return period.kind === "custom" ? { from: period.from, to: period.to } : PRESETS.find((p) => p.id === period.preset)!.resolve(today)
}

export function pipelinePeriodLabel(period: PipelinePeriodChoice) {
  return period.kind === "custom" ? formatLocalRange(period.from, period.to) : PRESETS.find((p) => p.id === period.preset)!.label
}

/* ─── Ordenação e Fechados ────────────────────────────────────────────────── */

export const boardSortLabels: Record<DealBoardSort, string> = {
  Stalled: "Mais tempo parado",
  ValueDesc: "Maior valor",
  Recent: "Mais recentes",
  ExpectedClose: "Previsão de fechamento",
}

export const BOARD_SORTS = Object.keys(boardSortLabels) as DealBoardSort[]

const SORT_URL: Record<DealBoardSort, string> = {
  Stalled: "parado",
  ValueDesc: "valor",
  Recent: "recentes",
  ExpectedClose: "previsao",
}

const CLOSED_URL: Record<DealBoardClosedGroup, string> = { won: "ganhos", lost: "perdidos" }

/* ─── URL ─────────────────────────────────────────────────────────────────── */

/** "todos" em `responsavel` = todos os responsáveis (a mesma convenção de Tarefas). */
export const ALL_OWNERS_URL = "todos"

export type PipelineUrlState = {
  period: PipelinePeriodChoice
  owner: OwnerFilter
  search: string
  sources: DealSource[]
  segments: string[]
  sort: DealBoardSort
  closedTab: DealBoardClosedGroup
}

export type RawPipelineUrl = {
  period: string
  from: string
  to: string
  owner: string
  search: string
  sources: string
  segments: string
  sort: string
  closed: string
  /** `origem`, de antes da PL2: uma origem só. */
  legacySource: string
}

/** Listas na URL: itens separados por vírgula, cada um codificado (um segmento pode ter vírgula). */
export const encodeList = (items: string[]) => items.map(encodeURIComponent).join(",")

export function decodeList(value: string): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((item) => {
      try {
        return decodeURIComponent(item).trim()
      } catch {
        return ""
      }
    })
    .filter(Boolean)
}

const isSource = (value: string): value is DealSource => value in sourceLabels

/**
 * Lê o estado do Pipeline na URL. Links antigos continuam valendo: `origem=MetaAds` vira a lista de
 * origens, e `responsavel=<id>` (que já era a chave) segue valendo. SDR sempre fica em "meus".
 */
export function parsePipelineUrl(raw: RawPipelineUrl, canSeeOthers: boolean): PipelineUrlState {
  const period: PipelinePeriodChoice =
    isLocalDate(raw.from) && isLocalDate(raw.to) && raw.from <= raw.to && daysInclusive(raw.from, raw.to) <= MAX_PIPELINE_PERIOD_DAYS
      ? { kind: "custom", from: raw.from, to: raw.to }
      : isPipelinePreset(raw.period)
        ? { kind: "preset", preset: raw.period }
        : DEFAULT_PIPELINE_PERIOD

  const owner: OwnerFilter =
    !canSeeOthers || !raw.owner ? { kind: "mine" } : raw.owner === ALL_OWNERS_URL ? { kind: "all" } : { kind: "user", userId: raw.owner }

  const listed = decodeList(raw.sources).filter(isSource)
  const sources = [...new Set(listed.length > 0 ? listed : isSource(raw.legacySource) ? [raw.legacySource] : [])]

  const sort = (Object.entries(SORT_URL).find(([, value]) => value === raw.sort)?.[0] as DealBoardSort | undefined) ?? "Stalled"
  const closedTab = raw.closed === CLOSED_URL.lost ? "lost" : "won"

  return {
    period,
    owner,
    search: raw.search.slice(0, 100),
    sources,
    segments: [...new Set(decodeList(raw.segments))].slice(0, 50),
    sort,
    closedTab,
  }
}

/** O que vai para `writeUrlState`. O padrão não aparece na URL, e a chave antiga `origem` sai. */
export function serializePipelineUrl(state: PipelineUrlState) {
  return {
    pipelinePeriod: state.period.kind === "preset" && state.period.preset !== "30d" ? state.period.preset : "",
    pipelineFrom: state.period.kind === "custom" ? state.period.from : "",
    pipelineTo: state.period.kind === "custom" ? state.period.to : "",
    ownerUserId: state.owner.kind === "all" ? ALL_OWNERS_URL : state.owner.kind === "user" ? state.owner.userId : "",
    pipelineSearch: state.search.trim(),
    pipelineSources: encodeList(state.sources),
    pipelineSegments: encodeList(state.segments),
    pipelineSort: state.sort === "Stalled" ? "" : SORT_URL[state.sort],
    pipelineClosed: state.closedTab === "won" ? "" : CLOSED_URL.lost,
    source: "",
  }
}
