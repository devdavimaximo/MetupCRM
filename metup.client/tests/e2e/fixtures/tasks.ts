/**
 * A API de tarefas dublada **com estado**: concluir, cancelar, reagendar e criar mudam a loja, e a
 * listagem e o resumo seguintes já refletem isso — como o servidor faria. As regras de recorte são
 * as de `TaskWindows` (back), simplificadas para o fuso fixo da suíte (America/Sao_Paulo, −03:00).
 *
 * O relógio do navegador é congelado em `NOW` (`page.clock.setFixedTime`) por `gotoTasks`, então
 * "Hoje · 16:00" e "Atrasada" não mudam com o dia em que a suíte roda.
 */

import type { Route } from "@playwright/test"

import type { ActivityType } from "@/features/activities/api"
import type { PagedResult, TaskItem, TaskSummary } from "@/features/tasks/api"
import type { Handler } from "./app"
import { task } from "./data"

/** Terça, 15/09/2026, 15:00 em São Paulo. */
export const NOW = "2026-09-15T15:00:00-03:00"
const NOW_MS = new Date(NOW).getTime()
const END_OF_TODAY = new Date("2026-09-16T00:00:00-03:00").getTime()
const END_OF_WEEK = new Date("2026-09-21T00:00:00-03:00").getTime()

const at = (localIso: string) => new Date(`${localIso}-03:00`).toISOString()
const OWNERS = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Davi Maximo" },
  { id: "u-2", name: "Ana Prado" },
]
const TYPES: ActivityType[] = ["Call", "WhatsApp", "Meeting", "Proposal"]
const COMPANIES = ["Padaria Aurora", "Mercado Bonfim", "Ótica Lumen", "Clínica Vida", "Auto Center Sul", "Pet Feliz", "Studio Forma"]

function seed(): TaskItem[] {
  const dues = [
    // 3 atrasadas
    "2026-09-13T10:00:00",
    "2026-09-14T17:00:00",
    "2026-09-15T10:00:00",
    // 2 hoje
    "2026-09-15T16:00:00",
    "2026-09-15T17:30:00",
    // 4 esta semana
    "2026-09-16T09:00:00",
    "2026-09-17T14:00:00",
    "2026-09-18T10:00:00",
    "2026-09-20T11:00:00",
    // 14 mais tarde
    ...Array.from({ length: 14 }, (_, i) => `2026-09-${String(22 + (i % 8)).padStart(2, "0")}T${String(9 + (i % 8)).padStart(2, "0")}:00:00`),
  ]

  const pending = dues.map((due, i) =>
    task({
      id: `task-${i + 1}`,
      dealId: `deal-${i + 1}`,
      companyId: `company-${i + 1}`,
      companyName: COMPANIES[i % COMPANIES.length] + (i >= COMPANIES.length ? ` ${Math.floor(i / COMPANIES.length) + 1}` : ""),
      type: TYPES[i % TYPES.length],
      dueDate: at(due),
      ownerUserId: OWNERS[i % 2].id,
      ownerUserName: OWNERS[i % 2].name,
      note: i % 3 === 0 ? "Retomar a proposta e alinhar próximos passos." : null,
      contactName: i % 3 === 1 ? "Marina Alves" : null,
      createdAt: at(`2026-09-${String(1 + (i % 10)).padStart(2, "0")}T12:00:00`),
      dealAmount: i % 4 === 3 ? null : 6_000 + i * 1_500,
      dealAmountIsEstimated: i % 5 === 2,
      dealStage: (["Prospect", "Qualificacao", "Reuniao", "Proposta", "Negociacao"] as const)[i % 5],
    })
  )

  const done = [0, 1].map((i) =>
    task({
      id: `task-done-${i + 1}`,
      dealId: `deal-done-${i + 1}`,
      companyName: `Concluída ${i + 1}`,
      dueDate: at(`2026-09-1${i}T10:00:00`),
      status: "Concluida",
      completedAt: at(`2026-09-1${i}T11:00:00`),
    })
  )

  return [...pending, ...done]
}

type Scope = "All" | "Overdue" | "Today" | "ThisWeek" | "Later"

export class TaskStore {
  tasks: TaskItem[] = seed()
  /** Tudo que a tela pediu à listagem, para o teste conferir parâmetros (página, ordenação, responsável). */
  listRequests: URLSearchParams[] = []
  summaryRequests: URLSearchParams[] = []
  created = 0

  private inScope(t: TaskItem, scope: Scope) {
    const due = new Date(t.dueDate).getTime()
    if (scope === "All") return t.status !== "Cancelada"
    if (t.status !== "Pendente") return false
    if (scope === "Overdue") return due < NOW_MS
    if (scope === "Today") return due >= NOW_MS && due < END_OF_TODAY
    if (scope === "ThisWeek") return due >= END_OF_TODAY && due < END_OF_WEEK
    return due >= END_OF_WEEK
  }

  count(scope: Scope) {
    return this.tasks.filter((t) => this.inScope(t, scope)).length
  }

  list: Handler = (route: Route) => {
    const params = new URL(route.request().url()).searchParams
    this.listRequests.push(params)
    const scope = (params.get("scope") ?? "All") as Scope
    const statuses = params.getAll("statuses")
    const types = params.getAll("types")
    const search = (params.get("search") ?? "").toLowerCase()
    const sort = params.get("sort") ?? "DueAsc"
    const page = Number(params.get("page") ?? 1)
    const pageSize = Number(params.get("pageSize") ?? 10)

    let items = this.tasks.filter((t) =>
      statuses.length > 0 && scope === "All" ? statuses.includes(t.status) : this.inScope(t, scope)
    )
    if (types.length > 0) items = items.filter((t) => types.includes(t.type))
    if (search) items = items.filter((t) => t.companyName.toLowerCase().includes(search) || (t.note ?? "").toLowerCase().includes(search))

    const byDue = (a: TaskItem, b: TaskItem) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id)
    const sorters: Record<string, (a: TaskItem, b: TaskItem) => number> = {
      DueAsc: byDue,
      DueDesc: (a, b) => -byDue(a, b),
      Recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
      Owner: (a, b) => a.ownerUserName.localeCompare(b.ownerUserName) || byDue(a, b),
      Status: (a, b) => a.status.localeCompare(b.status) || byDue(a, b),
    }
    items = [...items].sort(sorters[sort] ?? byDue)

    const body: PagedResult<TaskItem> = {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      totalCount: items.length,
      totalPages: Math.ceil(items.length / pageSize),
    }
    return body
  }

  summary: Handler = (route: Route) => {
    this.summaryRequests.push(new URL(route.request().url()).searchParams)
    const body: TaskSummary = {
      referenceDate: "2026-09-15",
      counts: {
        all: this.count("All"),
        overdue: this.count("Overdue"),
        today: this.count("Today"),
        thisWeek: this.count("ThisWeek"),
        later: this.count("Later"),
        completed30d: this.tasks.filter((t) => t.status === "Concluida").length,
        cancelled30d: this.tasks.filter((t) => t.status === "Cancelada").length,
      },
      previous: { overdue: 2, today: 2, thisWeek: 6 },
      weeklyCompleted: [],
      completedThisWeek: 2,
      completedPreviousWeek: 1,
      completedChangePct: 100,
    }
    return body
  }

  private update(route: Route, patch: (t: TaskItem) => Partial<TaskItem>) {
    const id = new URL(route.request().url()).pathname.split("/")[3]
    const index = this.tasks.findIndex((t) => t.id === id)
    this.tasks[index] = { ...this.tasks[index], ...patch(this.tasks[index]) }
    return this.tasks[index]
  }

  complete: Handler = (route) => this.update(route, () => ({ status: "Concluida", completedAt: new Date(NOW).toISOString() }))

  cancel: Handler = (route) => this.update(route, () => ({ status: "Cancelada" }))

  reschedule: Handler = (route) => {
    const { dueDate } = route.request().postDataJSON() as { dueDate: string }
    return this.update(route, () => ({ dueDate }))
  }

  /** As rotas de tarefa ligadas a esta loja — espalhe em `installApi(page, { ...store.routes() })`. */
  routes() {
    return {
      tasks: this.list,
      taskSummary: this.summary,
      completeTask: this.complete,
      cancelTask: this.cancel,
      rescheduleTask: this.reschedule,
      createTask: this.create,
    } satisfies Record<string, Handler>
  }

  create: Handler = (route) => {
    if (route.request().method() !== "POST") return route.fallback()
    const input = route.request().postDataJSON() as { dealId: string; type: ActivityType; dueDate: string; note?: string }
    this.created += 1
    const created = task({
      id: `task-new-${this.created}`,
      dealId: input.dealId,
      type: input.type,
      dueDate: input.dueDate,
      note: input.note ?? null,
      createdAt: new Date(NOW).toISOString(),
      ownerUserId: OWNERS[0].id,
      ownerUserName: OWNERS[0].name,
    })
    this.tasks.push(created)
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(created) })
  }
}
