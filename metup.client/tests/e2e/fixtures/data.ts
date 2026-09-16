/**
 * Os dados que a API dublada devolve. Tudo aqui é construído por função, para cada cenário pedir só
 * o recorte de que precisa (`overview({ revenue: { current: 0, previous: 0 } })`) sem repetir o DTO
 * inteiro. Os nomes dos campos acompanham `src/features/dashboard/api.ts`.
 */

/** O "hoje" de todo cenário. Fixo, para rótulo de data e janela de previsão não mudarem com o dia. */
export const TODAY = "2026-09-15"
export const PERIOD_START = "2026-08-17"

export type Json = Record<string, unknown>

export const session = {
  token: "token-de-teste",
  expiresAtUtc: "2099-01-01T00:00:00Z",
  user: {
    userId: "11111111-1111-1111-1111-111111111111",
    organizationId: "22222222-2222-2222-2222-222222222222",
    name: "Davi Maximo",
    email: "davi@exemplo.test",
    role: "Admin" as "Admin" | "Closer" | "Sdr",
  },
}

/** Uma série diária simples: só os dias com ganho têm receita, como acontece no B2B. */
function revenueSeries(days = 30) {
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

export const pipelineStages = [
  { stage: "Prospect", count: 42, amount: 210_000, estimatedCount: 12, stalledCount: 3 },
  { stage: "PrimeiroContato", count: 21, amount: 126_000, estimatedCount: 6, stalledCount: 1 },
  { stage: "Qualificacao", count: 14, amount: 98_000, estimatedCount: 2, stalledCount: 0 },
  { stage: "Reuniao", count: 9, amount: 81_000, estimatedCount: 1, stalledCount: 2 },
  { stage: "Proposta", count: 6, amount: 72_000, estimatedCount: 0, stalledCount: 0 },
  { stage: "Negociacao", count: 3, amount: 45_000, estimatedCount: 0, stalledCount: 1 },
]

export const recentEvents = [
  {
    id: "ev-1",
    kind: "DealWon",
    dealId: "deal-1",
    companyName: "Padaria Aurora",
    actorName: "Davi Maximo",
    occurredAt: "2026-09-15T13:40:00Z",
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
    toStage: null,
    activityType: "Call",
    outcome: "Interested",
    amount: null,
  },
]

export function overview(patch: Json = {}): Json {
  return {
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
    ...patch,
  }
}

export function task(patch: Json = {}): Json {
  return {
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
    ...patch,
  }
}

export function summary(patch: Json = {}): Json {
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

/** Uma página do feed. `cursor` nulo fecha o feed com "Fim da atividade". */
export function feedPage(index: number, hasNext: boolean) {
  return {
    items: Array.from({ length: 20 }, (_, position) => ({
      ...recentEvents[position % recentEvents.length],
      id: `feed-${index}-${position}`,
      occurredAt: new Date(Date.UTC(2026, 8, 15 - index, 13, 40 - position)).toISOString(),
    })),
    nextCursor: hasNext ? `cursor-${index + 1}` : null,
  }
}

export const notifications = [
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

export const searchResult = {
  companies: [{ id: "company-1", name: "Padaria Aurora", segment: "Alimentação", city: "Curitiba" }],
  contacts: [],
  deals: [{ id: "deal-1", companyId: "company-1", companyName: "Padaria Aurora", stage: "Negociacao", status: "Open", amount: 24_000 }],
}

export const users = [
  { id: "u-1", name: "Davi Maximo" },
  { id: "u-2", name: "Ana Prado" },
]

/** Lista paginada do Pipeline — o bastante para a tela abrir depois de clicar numa etapa. */
export const dealsPage = {
  items: [
    {
      id: "deal-1",
      companyId: "company-1",
      companyName: "Padaria Aurora",
      contactName: "Marina Alves",
      stage: "Negociacao",
      status: "Open",
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
  total: 1,
}
