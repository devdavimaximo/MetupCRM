import { test as base, expect, type Page, type Route } from "@playwright/test"

import * as data from "./data"
import { NOW, TaskStore } from "./tasks"

/** O endereço da API que o front chama (o mesmo padrão de `src/lib/api.ts`). */
const API = "http://localhost:5100"

/** Corpo JSON fixo da resposta. */
export type ResponseBody = Record<string, unknown> | unknown[]

/** Responde na hora (devolvendo o corpo) ou assume a rota (`route.fulfill`) e devolve `undefined`. */
export type Handler = (route: Route) => unknown

/**
 * Como cada rota da API responde neste cenário. A chave é o caminho; o valor é o corpo JSON ou uma
 * função de rota (para falhar, atrasar ou variar por chamada). Para uma falha, use `problem(...)`.
 */
export type ApiOverrides = Partial<Record<ApiPath, Handler | ResponseBody>>

export type ApiPath =
  | "overview"
  | "summary"
  | "feed"
  | "notifications"
  | "users"
  | "search"
  | "deals"
  | "deal"
  | "dealActivities"
  | "company"
  | "completeTask"
  | "tasks"
  | "taskSummary"
  | "createTask"
  | "cancelTask"
  | "rescheduleTask"
  | "reassignTask"
  | "taskCalendar"
  | "bulkTasks"
  | "logActivity"

const ROUTES: Record<ApiPath, string> = {
  overview: "**/api/dashboard/overview**",
  summary: "**/api/dashboard",
  feed: "**/api/activity-feed**",
  notifications: "**/api/notifications",
  users: "**/api/users",
  search: "**/api/search**",
  deals: "**/api/deals?**",
  deal: "**/api/deals/*",
  dealActivities: "**/api/deals/*/activities",
  company: "**/api/companies/*",
  completeTask: "**/api/tasks/*/complete",
  tasks: "**/api/tasks?**",
  taskSummary: "**/api/tasks/summary**",
  createTask: "**/api/tasks",
  cancelTask: "**/api/tasks/*/cancel",
  rescheduleTask: "**/api/tasks/*/reschedule",
  reassignTask: "**/api/tasks/*/reassign",
  taskCalendar: "**/api/tasks/calendar**",
  bulkTasks: "**/api/tasks/bulk",
  // Registrada depois de `dealActivities`: o POST cai aqui; o GET volta (fallback) para a timeline fixa.
  logActivity: "**/api/deals/*/activities",
}

/** Resposta de erro no formato que o `apiFetch` sabe traduzir. */
export function problem(title: string, status = 500): Handler {
  return (route) =>
    route.fulfill({ status, contentType: "application/problem+json", body: JSON.stringify({ title, status }) })
}

/** Três páginas de feed, escolhidas pelo cursor pedido — nunca por contador de chamadas. */
function feedByCursor(route: Route) {
  const cursor = new URL(route.request().url()).searchParams.get("cursor")
  const index = cursor ? Number(cursor.replace("cursor-", "")) : 0
  return data.feedPage(index, index < 2)
}

function defaults(): Record<ApiPath, Handler | ResponseBody> {
  const store = new TaskStore()
  return {
    overview: data.overview(),
    summary: data.summary(),
    feed: feedByCursor,
    notifications: data.notifications,
    users: data.users,
    search: data.searchResult,
    deals: data.dealsPage,
    deal: data.deal,
    dealActivities: data.dealActivities,
    company: data.company,
    ...store.routes(),
    // O dashboard conclui a tarefa-1 da própria fila (não da loja): a resposta fixa de antes continua.
    completeTask: data.task({ status: "Concluida", completedAt: "2026-09-15T17:05:00Z" }),
  }
}

/**
 * Dubla a API inteira e entra já autenticado. Nenhum mock vive dentro do app: o que muda o cenário
 * é sempre `overrides`, aqui nos testes.
 */
export async function installApi(page: Page, overrides: ApiOverrides = {}) {
  const responses = { ...defaults(), ...overrides }

  await page.addInitScript((session) => {
    window.localStorage.setItem("metup.session", JSON.stringify(session))
    // Sem preferência salva, todo cenário começa no período padrão de 30 dias.
    window.localStorage.removeItem("metup.dashboard.period")
  }, data.session)

  // O hub não sobe nos testes: o front fica em "Reconectando…" e revalida por foco, que é o caminho
  // que a suíte exercita. Cortar o negociate aqui evita espera de rede a cada cenário.
  await page.route("**/hubs/dashboard/**", (route) => route.abort())

  // Primeiro a rede de segurança: uma chamada não prevista falha alto, em vez de vazar para a API
  // real. O Playwright casa a rota registrada por último, então as específicas vêm depois desta.
  await page.route(`${API}/api/**`, (route) => route.fulfill({ status: 501, body: "rota não prevista no cenário" }))

  for (const [key, pattern] of Object.entries(ROUTES) as [ApiPath, string][]) {
    await page.route(pattern, async (route) => {
      const response = responses[key]
      if (typeof response === "function") {
        const result = await (response as Handler)(route)
        // Um handler que já respondeu (fulfill/abort) devolve undefined; qualquer outra coisa é corpo.
        if (result === undefined) return
        return route.fulfill({ contentType: "application/json", body: JSON.stringify(result) })
      }
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(response) })
    })
  }
}

export async function gotoDashboard(page: Page, query = "") {
  await page.goto(`/${query}`)
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Bom dia|Boa tarde|Boa noite/)
}

/**
 * Abre a tela de Tarefas com o relógio do navegador congelado em `NOW` (terça, 15/09/2026, 15:00),
 * o mesmo "agora" da `TaskStore`. `query` entra depois de `vista=tarefas` (ex.: `&aba=hoje`).
 */
export async function gotoTasks(page: Page, query = "") {
  await page.clock.setFixedTime(new Date(NOW))
  await page.goto(`/?vista=tarefas${query}`)
  await expect(page.getByRole("heading", { level: 1, name: "Tarefas" })).toBeVisible()
}

export const test = base
export { expect, data, TaskStore }
