import { isLocalDate, toLocalDate, type LocalDate } from "@/lib/local-date"
import type { TaskItem, TaskScope } from "./api"

const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" })
const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" })
const dayMonthYear = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Dias de calendário (não blocos de 24h) entre as duas datas: 23:59 → 00:01 já é "amanhã". */
function calendarDayDiff(date: Date, reference: Date) {
  return Math.round((startOfDay(date).getTime() - startOfDay(reference).getTime()) / 86_400_000)
}

/** "Hoje · 10:00", "Amanhã · 09:00", "Ontem · 17:00", "16/09 · 10:00" e "16/09/2027 · 10:00" em outro ano. */
export function formatTaskDue(iso: string, now: Date): string {
  const due = new Date(iso)
  const hour = time.format(due)
  const diff = calendarDayDiff(due, now)
  if (diff === 0) return `Hoje · ${hour}`
  if (diff === 1) return `Amanhã · ${hour}`
  if (diff === -1) return `Ontem · ${hour}`
  const day = due.getFullYear() === now.getFullYear() ? dayMonth.format(due) : dayMonthYear.format(due)
  return `${day} · ${hour}`
}

/** "há 2 dias", "há 3h", "há 5 min" — só para prazos que já passaram; `null` antes disso. */
export function formatOverdueSince(iso: string, now: Date): string | null {
  const due = new Date(iso)
  const diffMs = now.getTime() - due.getTime()
  if (diffMs <= 0) return null
  const days = -calendarDayDiff(due, now)
  if (days >= 1) return days === 1 ? "há 1 dia" : `há ${days} dias`
  const hours = Math.floor(diffMs / 3_600_000)
  if (hours >= 1) return `há ${hours}h`
  return `há ${Math.max(1, Math.floor(diffMs / 60_000))} min`
}

/** Pendente com prazo vencido. Concluída e cancelada nunca estão "atrasadas". */
export function isTaskOverdue(task: Pick<TaskItem, "status" | "dueDate">, now: Date) {
  return task.status === "Pendente" && new Date(task.dueDate).getTime() < now.getTime()
}

/* ─── Atalhos de prazo ───────────────────────────────────────────────────── */

function at(base: Date, days: number, hour: number) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days, hour, 0, 0, 0)
}

/** Próxima hora cheia: 14:20 → 15:00; 14:00 em ponto → 15:00 (nunca "agora", que já é passado ao salvar). */
export function nextFullHour(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0)
}

/** A segunda-feira seguinte, às `hour`h. Numa segunda, é a da semana que vem. */
export function nextMondayAt(now: Date, hour = 9) {
  const days = ((8 - now.getDay()) % 7) || 7
  return at(now, days, hour)
}

export type DueShortcut = { id: string; label: string; date: Date }

/**
 * Atalhos de prazo. `today` diz o que "Hoje" significa: 18h para reagendar (o fim do expediente) e a
 * próxima hora cheia para criar. Atalho que já passou (Hoje 18h às 19h) não aparece.
 */
export function dueShortcuts(now: Date, today: "evening" | "next-hour"): DueShortcut[] {
  const shortcuts: DueShortcut[] = [
    today === "evening"
      ? { id: "today", label: "Hoje 18h", date: at(now, 0, 18) }
      : { id: "today", label: "Hoje", date: nextFullHour(now) },
    { id: "tomorrow", label: "Amanhã 9h", date: at(now, 1, 9) },
    { id: "plus3", label: "+3 dias", date: at(now, 3, 9) },
    { id: "monday", label: "Próx. segunda 9h", date: nextMondayAt(now) },
  ]
  // "Hoje" pela próxima hora cheia depois das 23h cai amanhã: aí o atalho não diz a verdade e sai.
  return shortcuts.filter((s) => s.date > now && (s.id !== "today" || s.date.getDate() === now.getDate()))
}

/** Valor de `<input type="datetime-local">` no horário do navegador. */
export function toDateTimeInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export type PageItem = number | "ellipsis-start" | "ellipsis-end"

/**
 * Páginas numeradas com reticências: primeira, última e uma de cada lado da atual
 * (1 … 4 5 6 … 24). Até 7 páginas cabem inteiras. Um buraco de uma página só vira o número, não "…".
 */
export function pageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const page = Math.min(Math.max(current, 1), total)
  let start = Math.max(2, page - 1)
  let end = Math.min(total - 1, page + 1)
  // Perto das pontas, a janela cresce para o mesmo número de itens: 1 2 3 4 5 … 24.
  if (page <= 3) end = 5
  if (page >= total - 2) start = total - 4

  const items: PageItem[] = [1]
  if (start === 3) items.push(2)
  else if (start > 3) items.push("ellipsis-start")
  for (let p = start; p <= end; p++) items.push(p)
  if (end === total - 2) items.push(total - 1)
  else if (end < total - 2) items.push("ellipsis-end")
  items.push(total)
  return items
}

/** "Mostrando 1–10 de 239 tarefas". */
export function rangeLabel(page: number, pageSize: number, totalCount: number) {
  if (totalCount === 0) return "Nenhuma tarefa"
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalCount)
  const count = new Intl.NumberFormat("pt-BR")
  return `Mostrando ${count.format(from)}–${count.format(to)} de ${count.format(totalCount)} ${totalCount === 1 ? "tarefa" : "tarefas"}`
}

/* ─── Estado da tela na URL ──────────────────────────────────────────────── */

export const TASK_TABS: TaskScope[] = ["All", "Overdue", "Today", "ThisWeek", "Later"]

/** Os valores da URL ficam em português, como o resto da navegação (`vista=tarefas`). */
const TAB_TO_URL: Record<TaskScope, string> = {
  All: "todas",
  Overdue: "atrasadas",
  Today: "hoje",
  ThisWeek: "semana",
  Later: "depois",
}

export const PAGE_SIZES = [10, 25, 50] as const
export type PageSize = (typeof PAGE_SIZES)[number]

/** "todos" na chave `responsavel` = todos os responsáveis; um id = aquele usuário; vazio = eu. */
export const ALL_OWNERS_URL = "todos"

export type OwnerFilter = { kind: "mine" } | { kind: "all" } | { kind: "user"; userId: string }

export type TasksUrlState = {
  tab: TaskScope
  page: number
  pageSize: PageSize
  referenceDate: LocalDate | null
  owner: OwnerFilter
  /** Só o link antigo `status=Concluida` preenche: vira o filtro de status da aba Todas. */
  statuses: ("Concluida" | "Cancelada")[]
}

export type RawTasksUrl = {
  tab: string
  page: string
  pageSize: string
  date: string
  owner: string
  /** Legado (TasksPage até a T1): `status`, `prazoDe`, `prazoAte`. */
  legacyStatus: string
  legacyDueFrom: string
  legacyDueTo: string
}

/**
 * Lê o estado da tela a partir da URL, aceitando os links antigos:
 * - `status=Concluida` → aba Todas com o filtro de status Concluída;
 * - `prazoDe`/`prazoAte` → a data de referência passa a ser `prazoDe` (ou `prazoAte`); o mesmo dia nas
 *   duas pontas abre a aba Hoje, um intervalo abre Todas. Não existe mais filtro por intervalo de prazo.
 * O que for inválido cai no padrão, nunca em erro.
 */
export function parseTasksUrl(raw: RawTasksUrl, canSeeOthers: boolean): TasksUrlState {
  const tabFromUrl = (Object.keys(TAB_TO_URL) as TaskScope[]).find((tab) => TAB_TO_URL[tab] === raw.tab)
  const page = Number(raw.page)
  const pageSize = Number(raw.pageSize)

  let tab: TaskScope = tabFromUrl ?? "All"
  let referenceDate: LocalDate | null = isLocalDate(raw.date) ? raw.date : null
  const statuses: TasksUrlState["statuses"] = []

  if (raw.legacyStatus === "Concluida" || raw.legacyStatus === "Cancelada") {
    tab = "All"
    statuses.push(raw.legacyStatus)
  }

  const legacyFrom = isLocalDate(raw.legacyDueFrom) ? raw.legacyDueFrom : null
  const legacyTo = isLocalDate(raw.legacyDueTo) ? raw.legacyDueTo : null
  if (!referenceDate && (legacyFrom || legacyTo)) {
    referenceDate = legacyFrom ?? legacyTo
    if (!tabFromUrl && statuses.length === 0) tab = legacyFrom && legacyFrom === legacyTo ? "Today" : "All"
  }

  const owner: OwnerFilter = !canSeeOthers || !raw.owner
    ? { kind: "mine" }
    : raw.owner === ALL_OWNERS_URL
      ? { kind: "all" }
      : { kind: "user", userId: raw.owner }

  return {
    tab,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? (pageSize as PageSize) : 10,
    referenceDate,
    owner,
    statuses,
  }
}

/** O que a tela escreve de volta. Chaves legadas saem sempre vazias (e somem da URL). */
export function serializeTasksUrl(state: Omit<TasksUrlState, "statuses">, today: LocalDate) {
  return {
    tasksTab: state.tab === "All" ? "" : TAB_TO_URL[state.tab],
    tasksPage: state.page > 1 ? String(state.page) : "",
    tasksPageSize: state.pageSize === 10 ? "" : String(state.pageSize),
    tasksDate: state.referenceDate && state.referenceDate !== today ? state.referenceDate : "",
    ownerUserId: state.owner.kind === "all" ? ALL_OWNERS_URL : state.owner.kind === "user" ? state.owner.userId : "",
    taskStatus: "",
    dueFrom: "",
    dueTo: "",
  }
}

export const todayOf = (now: Date): LocalDate => toLocalDate(now)

/** "Primeiro Último" — o do meio some, para a coluna não quebrar. */
export function shortName(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.length <= 2 ? name.trim() : `${parts[0]} ${parts[parts.length - 1]}`
}
