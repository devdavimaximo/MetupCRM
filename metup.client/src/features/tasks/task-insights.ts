import type { DonutSlice } from "@/components/charts/DonutBreakdown"
import { numberFormatter } from "@/lib/format"
import type { BulkTaskAction, BulkTaskFailureReason, BulkTaskResult, TaskScope, TaskStatus, TaskSummary } from "./api"

/* ─── Porcentagens que somam 100 ──────────────────────────────────────────── */

/**
 * Porcentagens inteiras que somam exatamente 100 (método do maior resto): arredonda para baixo e
 * distribui os pontos que faltam para as maiores frações; empate vai para quem vem antes. Total zero
 * = tudo zero.
 */
export function largestRemainderPercents(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0)
  if (total === 0) return values.map(() => 0)

  const exact = values.map((v) => (v * 100) / total)
  const floors = exact.map(Math.floor)
  let missing = 100 - floors.reduce((sum, v) => sum + v, 0)

  const byRemainder = exact
    .map((v, index) => ({ index, remainder: v - Math.floor(v) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)

  for (const { index } of byRemainder) {
    if (missing === 0) break
    floors[index] += 1
    missing -= 1
  }
  return floors
}

/* ─── Donut "Tarefas por status" ─────────────────────────────────────────── */

/** Para onde a fatia leva: a aba e, em Concluídas, o filtro de status da aba Todas. */
export type StatusSliceTarget = { tab: TaskScope; statuses: TaskStatus[] }

export type StatusSlice = DonutSlice & { key: StatusSliceKey; percent: number; target: StatusSliceTarget }

export type StatusSliceKey = "overdue" | "today" | "thisWeek" | "later" | "completed"

/**
 * Atrasadas e Concluídas são status (cores reservadas de perigo e sucesso); Hoje → Esta semana →
 * Mais tarde é urgência decrescente, numa rampa de um só tom (o dourado do acento, do mais forte ao
 * mais apagado). Validada contra a superfície escura: vizinhos com ΔE ≥ 12 para daltonismo. O tom
 * de "Mais tarde" fica abaixo de 3:1 com o fundo — a legenda sempre traz rótulo e número.
 */
export const STATUS_SLICE_COLORS: Record<StatusSliceKey, string> = {
  overdue: "var(--color-danger)",
  today: "var(--color-accent)",
  thisWeek: "#b37b1f",
  later: "#735221",
  completed: "var(--color-success)",
}

const SLICE_DEFS: { key: StatusSliceKey; label: string; count: (c: TaskSummary["counts"]) => number; target: StatusSliceTarget }[] = [
  { key: "overdue", label: "Atrasadas", count: (c) => c.overdue, target: { tab: "Overdue", statuses: [] } },
  { key: "today", label: "Hoje", count: (c) => c.today, target: { tab: "Today", statuses: [] } },
  { key: "thisWeek", label: "Esta semana", count: (c) => c.thisWeek, target: { tab: "ThisWeek", statuses: [] } },
  { key: "later", label: "Mais tarde", count: (c) => c.later, target: { tab: "Later", statuses: [] } },
  { key: "completed", label: "Concluídas (30 dias)", count: (c) => c.completed30d, target: { tab: "All", statuses: ["Concluida"] } },
]

/**
 * As cinco fatias, na ordem fixa (a cor segue a fatia, não a posição). Fatias zeradas saem do anel,
 * mas o % das que ficam é calculado sobre as cinco — com soma 100. Canceladas ficam fora.
 */
export function statusSlices(counts: TaskSummary["counts"]): { slices: StatusSlice[]; total: number } {
  const values = SLICE_DEFS.map((def) => def.count(counts))
  const percents = largestRemainderPercents(values)
  const total = values.reduce((sum, v) => sum + v, 0)

  const slices = SLICE_DEFS.map((def, i) => ({
    key: def.key,
    label: def.label,
    value: values[i],
    color: STATUS_SLICE_COLORS[def.key],
    percent: percents[i],
    target: def.target,
  })).filter((slice) => slice.value > 0)

  return { slices, total }
}

/* ─── Destaques da semana ────────────────────────────────────────────────── */

/** De quem é o número: o próprio usuário, a equipe inteira ou um responsável escolhido. */
export type HighlightSubject = { kind: "self" } | { kind: "team" } | { kind: "user"; name: string }

const tasksCount = (n: number) => `${n} ${n === 1 ? "tarefa concluída" : "tarefas concluídas"}`

function subjectOf(subject: HighlightSubject) {
  if (subject.kind === "self") return "Você"
  if (subject.kind === "team") return "A equipe"
  return subject.name
}

/**
 * A frase dos destaques. "Semana" aqui são os **7 dias corridos** que terminam na referência (regra
 * da T1), nunca a semana de calendário — daí "nos últimos 7 dias" quando não há comparação.
 */
export function weeklyHighlight(
  summary: Pick<TaskSummary, "completedThisWeek" | "completedPreviousWeek" | "completedChangePct">,
  subject: HighlightSubject
): string {
  const { completedThisWeek: current, completedPreviousWeek: previous, completedChangePct: pct } = summary

  if (pct === null) {
    return current === 0 ? "Nenhuma tarefa concluída nos últimos 7 dias." : `${capitalize(tasksCount(current))} nos últimos 7 dias.`
  }
  if (current === previous) return `Mesmo ritmo da semana anterior: ${tasksCount(current)}.`

  const magnitude = Math.max(1, Math.round(Math.abs(pct)))
  return `${subjectOf(subject)} concluiu ${magnitude}% ${current > previous ? "mais" : "menos"} tarefas nesta semana do que na anterior.`
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/* ─── Resultado das ações em massa ───────────────────────────────────────── */

const doneVerb: Record<BulkTaskAction, [string, string]> = {
  Complete: ["concluída", "concluídas"],
  Cancel: ["cancelada", "canceladas"],
  Reschedule: ["reagendada", "reagendadas"],
  Reassign: ["reatribuída", "reatribuídas"],
}

export const failureReasonLabels: Record<BulkTaskFailureReason, string> = {
  NotPending: "já estava concluída ou cancelada",
  NotFound: "não encontrada ou fora do seu alcance",
}

/** "8 concluídas · 2 não puderam ser alteradas" — a mensagem acessível depois do lote. */
export function bulkResultMessage(action: BulkTaskAction, result: BulkTaskResult) {
  const ok = result.succeeded.length
  const [one, many] = doneVerb[action]
  const parts = [`${numberFormatter.format(ok)} ${ok === 1 ? one : many}`]
  const failed = result.failed.length
  if (failed > 0) parts.push(`${numberFormatter.format(failed)} ${failed === 1 ? "não pôde ser alterada" : "não puderam ser alteradas"}`)
  return parts.join(" · ")
}
