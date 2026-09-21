/**
 * Os dados que a API dublada devolve. Tudo aqui é construído por função, para cada cenário pedir só
 * o recorte de que precisa (`overview({ revenue: { current: 0, previous: 0 } })`) sem repetir o DTO
 * inteiro. Cada corpo é tipado contra o DTO do front (`satisfies`, sem cast): um valor fora do enum
 * quebra no `tsc -b`, não na tela três ondas depois.
 */

import type { Activity } from "@/features/activities/api"
import type { Company } from "@/features/companies/api"
import type {
  ActivityFeedPage,
  DashboardOverview,
  DashboardSummary,
  PipelineStage,
  RecentEvent,
  RevenuePoint,
} from "@/features/dashboard/api"
import type { Deal, DealListItem, PagedResult, UserSummary } from "@/features/deals/api"
import type { AppNotification } from "@/features/notifications/api"
import type { SearchResult } from "@/features/search/api"
import type { TaskItem } from "@/features/tasks/api"
import type { Session } from "@/lib/auth"

/** O "hoje" de todo cenário. Fixo, para rótulo de data e janela de previsão não mudarem com o dia. */
export const TODAY = "2026-09-15"
export const PERIOD_START = "2026-08-17"

export const session: Session = {
  token: "token-de-teste",
  expiresAtUtc: "2099-01-01T00:00:00Z",
  user: {
    userId: "11111111-1111-1111-1111-111111111111",
    organizationId: "22222222-2222-2222-2222-222222222222",
    name: "Davi Maximo",
    email: "davi@exemplo.test",
    role: "Admin",
  },
}

/** Uma série diária simples: só os dias com ganho têm receita, como acontece no B2B. */
function revenueSeries(days = 30): RevenuePoint[] {
  const start = new Date(`${PERIOD_START}T12:00:00`)
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    const won = index % 7 === 3 ? 1 : 0
    return {
      bucketStart: day.toISOString().slice(0, 10),
      revenue: won * 9_500,
      wonDeals: won,
      lostDeals: index % 11 === 5 ? 1 : 0,
    }
  })
}

export const pipelineStages: PipelineStage[] = [
  { stage: "Prospect", count: 42, amount: 210_000, estimatedCount: 12, stalledCount: 3 },
  { stage: "PrimeiroContato", count: 21, amount: 126_000, estimatedCount: 6, stalledCount: 1 },
  { stage: "Qualificacao", count: 14, amount: 98_000, estimatedCount: 2, stalledCount: 0 },
  { stage: "Reuniao", count: 9, amount: 81_000, estimatedCount: 1, stalledCount: 2 },
  { stage: "Proposta", count: 6, amount: 72_000, estimatedCount: 0, stalledCount: 0 },
  { stage: "Negociacao", count: 3, amount: 45_000, estimatedCount: 0, stalledCount: 1 },
]

export const recentEvents: RecentEvent[] = [
  {
    id: "ev-1",
    kind: "DealWon",
    dealId: "deal-1",
    companyName: "Padaria Aurora",
    actorName: "Davi Maximo",
    occurredAt: "2026-09-15T13:40:00Z",
    occurredOnLocal: TODAY,
    toStage: null,
    activityType: null,
    outcome: null,
    amount: 9_500,
  },
  {
    id: "ev-2",
    kind: "StageAdvanced",
    dealId: "deal-2",
    companyName: "Mercado Bonfim",
    actorName: "Ana Prado",
    occurredAt: "2026-09-15T12:10:00Z",
    occurredOnLocal: TODAY,
    toStage: "Proposta",
    activityType: null,
    outcome: null,
    amount: null,
  },
  {
    id: "ev-3",
    kind: "Activity",
    dealId: "deal-3",
    companyName: "Clínica Vitória",
    actorName: "Davi Maximo",
    occurredAt: "2026-09-15T11:05:00Z",
    occurredOnLocal: TODAY,
    toStage: null,
    activityType: "Call",
    outcome: "Interessado",
    amount: null,
  },
]

export function overview(patch: Partial<DashboardOverview> = {}): DashboardOverview {
  const body = {
    periodDays: 30,
    scope: "Organization",
    periodStart: "2026-08-17T03:00:00Z",
    periodEnd: "2026-09-16T03:00:00Z",
    previousStart: "2026-07-18T03:00:00Z",
    periodStartLocal: PERIOD_START,
    periodEndLocal: TODAY,
    historyStart: "2025-02-01T03:00:00Z",
    revenue: { current: 48_500, previous: 31_000 },
    wonDeals: { current: 5, previous: 4 },
    lostDeals: { current: 2, previous: 3 },
    newDeals: { current: 37, previous: 29 },
    proposalsSent: { current: 11, previous: 8 },
    meetingsHeld: { current: 14, previous: 14 },
    callsMade: { current: 213, previous: 187 },
    revenueSeries: revenueSeries(),
    seriesGranularity: "day",
    pipeline: pipelineStages,
    stageAdvanceRates: pipelineStages.map((stage, index) => ({
      stage: stage.stage,
      enteredCount: 60 - index * 8,
      advancedCount: 40 - index * 6,
      advanceRate: 0.66 - index * 0.04,
      averageDaysInStage: 4 + index,
    })),
    weightedForecast: 96_400,
    expectedClose: {
      windowStartLocal: TODAY,
      windowEndLocal: "2026-10-14",
      expectedToCloseAmount: 54_000,
      expectedToCloseCount: 4,
      overdueExpectedCount: 2,
      openDealsWithExpectedCloseDate: 9,
    },
    openDealsWithoutAmount: 21,
    stalledAfterDays: 14,
    featuredDeals: [
      {
        id: "deal-1",
        companyId: "company-1",
        companyName: "Padaria Aurora",
        stage: "Negociacao",
        amount: 24_000,
        isEstimated: false,
        ownerUserName: "Davi Maximo",
        daysInStage: 6,
        nextTaskDueDate: "2026-09-16T14:00:00Z",
        nextTaskType: "Call",
        expectedCloseDate: "2026-09-30",
      },
      {
        id: "deal-2",
        companyId: "company-2",
        companyName: "Mercado Bonfim",
        stage: "Proposta",
        amount: 18_000,
        isEstimated: true,
        ownerUserName: "Ana Prado",
        daysInStage: 19,
        nextTaskDueDate: null,
        nextTaskType: null,
        expectedCloseDate: null,
      },
      {
        id: "deal-3",
        companyId: "company-3",
        companyName: "Clínica Vitória",
        stage: "Reuniao",
        amount: null,
        isEstimated: false,
        ownerUserName: "Davi Maximo",
        daysInStage: 2,
        nextTaskDueDate: "2026-09-17T18:30:00Z",
        nextTaskType: "Meeting",
        expectedCloseDate: "2026-10-05",
      },
    ],
    recentEvents,
    sources: [
      { source: "Sdr", newDeals: 18, wonDeals: 3, revenue: 28_500 },
      { source: "WhatsApp", newDeals: 11, wonDeals: 2, revenue: 20_000 },
      { source: "Indicacao", newDeals: 5, wonDeals: 0, revenue: 0 },
      { source: "MetaAds", newDeals: 3, wonDeals: 0, revenue: 0 },
    ],
    owners: [
      { ownerUserId: "u-1", ownerUserName: "Davi Maximo", wonDeals: 3, revenue: 28_500, openDeals: 24, openAmount: 320_000 },
      { ownerUserId: "u-2", ownerUserName: "Ana Prado", wonDeals: 2, revenue: 20_000, openDeals: 18, openAmount: 212_000 },
    ],
  } satisfies DashboardOverview
  return { ...body, ...patch }
}

export function task(patch: Partial<TaskItem> = {}): TaskItem {
  const body = {
    id: "task-1",
    dealId: "deal-1",
    companyId: "company-1",
    companyName: "Padaria Aurora",
    type: "Call",
    dueDate: "2026-09-15T17:00:00Z",
    ownerUserId: "u-1",
    ownerUserName: "Davi Maximo",
    note: null,
    status: "Pendente",
    createdAt: "2026-09-10T12:00:00Z",
    completedAt: null,
    dealStage: "Proposta",
    dealAmount: 24_000,
    dealAmountIsEstimated: false,
    contactName: null,
  } satisfies TaskItem
  return { ...body, ...patch }
}

export function summary(patch: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    taskCounts: { overdue: 3, today: 5, upcoming: 9 },
    nextTasks: [
      task(),
      task({ id: "task-2", dealId: "deal-2", companyName: "Mercado Bonfim", type: "WhatsApp" }),
      task({ id: "task-3", dealId: "deal-3", companyName: "Clínica Vitória", type: "Meeting" }),
    ],
    ...patch,
  }
}

/**
 * Uma página do feed, um dia por página. `cursor` nulo fecha o feed com "Fim da atividade". Os
 * horários (13h UTC, 10h em Brasília) caem no mesmo dia nos dois fusos, como o servidor devolveria.
 */
export function feedPage(index: number, hasNext: boolean): ActivityFeedPage {
  const day = new Date(Date.UTC(2026, 8, 15 - index))
  return {
    items: Array.from({ length: 20 }, (_, position) => ({
      ...recentEvents[position % recentEvents.length],
      id: `feed-${index}-${position}`,
      occurredAt: new Date(Date.UTC(2026, 8, 15 - index, 13, 40 - position)).toISOString(),
      occurredOnLocal: day.toISOString().slice(0, 10),
    })),
    nextCursor: hasNext ? `cursor-${index + 1}` : null,
  }
}

export const notifications: AppNotification[] = [
  {
    id: "n-1",
    kind: "TaskOverdue",
    severity: "Critical",
    occurredAt: "2026-09-15T12:00:00Z",
    dueAt: "2026-09-15T11:00:00Z",
    title: "Padaria Aurora",
    dealId: "deal-1",
    taskId: "task-1",
    conversationId: null,
    taskType: "Call",
    stalledDealDays: null,
  },
  {
    id: "n-2",
    kind: "DealStalledToday",
    severity: "Warning",
    occurredAt: "2026-09-15T09:00:00Z",
    dueAt: null,
    title: "Mercado Bonfim",
    dealId: "deal-2",
    taskId: null,
    conversationId: null,
    taskType: null,
    stalledDealDays: 14,
  },
]

export const searchResult: SearchResult = {
  companies: [{ id: "company-1", name: "Padaria Aurora", segment: "Alimentação", city: "Curitiba" }],
  contacts: [],
  deals: [
    {
      id: "deal-1",
      companyId: "company-1",
      companyName: "Padaria Aurora",
      stage: "Negociacao",
      status: "Aberto",
      amount: 24_000,
      ownerUserName: "Davi Maximo",
    },
    {
      id: "deal-9",
      companyId: "company-1",
      companyName: "Padaria Aurora",
      stage: "Ganho",
      status: "Ganho",
      amount: 8_000,
      ownerUserName: "Davi Maximo",
    },
  ],
}

export const users: UserSummary[] = [
  { id: "u-1", name: "Davi Maximo", role: "Admin" },
  { id: "u-2", name: "Ana Prado", role: "Sdr" },
]

/** Lista paginada do Pipeline — o bastante para a tela abrir depois de clicar numa etapa. */
export const dealsPage: PagedResult<DealListItem> = {
  items: [
    {
      id: "deal-1",
      companyId: "company-1",
      companyName: "Padaria Aurora",
      contactId: "contact-1",
      contactName: "Marina Alves",
      stage: "Negociacao",
      status: "Aberto",
      source: "Sdr",
      amount: 24_000,
      ticket: 24_000,
      ownerUserId: "u-1",
      ownerUserName: "Davi Maximo",
      createdAt: "2026-08-20T12:00:00Z",
      closedAt: null,
      expectedCloseDate: "2026-09-30",
    },
  ],
  page: 1,
  pageSize: 25,
  totalCount: 1,
  totalPages: 1,
}

/** O negócio que o drawer do Pipeline abre (`GET /api/deals/deal-1`). */
export const deal: Deal = {
  ...dealsPage.items[0],
  stageHistory: [
    { id: "sc-1", fromStage: null, toStage: "Prospect", changedAt: "2026-08-20T12:00:00Z", changedByUserId: "u-1" },
    { id: "sc-2", fromStage: "Prospect", toStage: "Negociacao", changedAt: "2026-09-09T12:00:00Z", changedByUserId: "u-1" },
  ],
  value: dealsPage.items[0].amount ?? dealsPage.items[0].ticket,
  valueIsEstimated: dealsPage.items[0].amount === null && dealsPage.items[0].ticket !== null,
  lostReason: null,
  lostNote: null,
}

export const company: Company = {
  id: "company-1",
  name: "Padaria Aurora",
  segment: "Alimentação",
  city: "Curitiba",
  instagram: null,
  phone: null,
  contacts: [
    { id: "contact-1", companyId: "company-1", name: "Marina Alves", role: "Sócia", phone: null, whatsApp: null, email: null },
  ],
}

export const dealActivities: Activity[] = [
  {
    id: "activity-1",
    dealId: "deal-1",
    contactId: "contact-1",
    contactName: "Marina Alves",
    type: "Call",
    outcome: "Interessado",
    note: null,
    authorUserId: "u-1",
    authorUserName: "Davi Maximo",
    occurredAt: "2026-09-12T14:00:00Z",
    createdAt: "2026-09-12T14:00:00Z",
  },
]
