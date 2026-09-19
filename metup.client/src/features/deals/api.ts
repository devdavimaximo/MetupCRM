import { apiFetch, ApiError } from "@/lib/api"
import type { ActivityType } from "@/features/activities/api"

export type DealStage =
  | "Prospect"
  | "PrimeiroContato"
  | "ContatoRealizado"
  | "Qualificacao"
  | "Reuniao"
  | "Proposta"
  | "Negociacao"
  | "Ganho"
  | "Perdido"

/** Mesmos nomes do enum do servidor — "MetaAds" é o que o n8n envia; nunca renomear. */
export type DealSource =
  | "Sdr"
  | "WhatsApp"
  | "MetaAds"
  | "Indicacao"
  | "Site"
  | "LinkedIn"
  | "Outbound"
  | "Evento"
  | "Outro"

export type DealStatus = "Aberto" | "Ganho" | "Perdido"

/** Mesmos nomes do enum do servidor; obrigatório ao fechar como perdido. */
export type LostReason = "Preco" | "SemInteresse" | "Concorrente" | "SemResposta" | "Timing" | "Outro"

export type UserSummary = {
  id: string
  name: string
  role: "Admin" | "Closer" | "Sdr"
}

export type StageChange = {
  id: string
  fromStage: DealStage | null
  toStage: DealStage
  changedAt: string
  changedByUserId: string
}

export type DealListItem = {
  id: string
  companyId: string
  companyName: string
  contactId: string | null
  contactName: string | null
  stage: DealStage
  source: DealSource
  ownerUserId: string
  ownerUserName: string
  ticket: number | null
  amount: number | null
  /** Data local da organização ("2026-10-01"), sem hora — nunca reconverter fuso. */
  expectedCloseDate: string | null
  status: DealStatus
  createdAt: string
  closedAt: string | null
}

export type Deal = DealListItem & {
  stageHistory: StageChange[]
  /** Só em negócio perdido; nulo nos perdidos anteriores ao campo. */
  lostReason: LostReason | null
  lostNote: string | null
}

// ---------------------------------------------------------------------------------------------
// Pipeline (quadro, resumo e evolução). Contrato da PL1 — a tela passa a usar na PL2.
// ---------------------------------------------------------------------------------------------

/** Ordenação dentro da coluna; o servidor sempre desempata pelo id. */
export type DealBoardSort = "Stalled" | "ValueDesc" | "Recent" | "ExpectedClose"

export type DealBoardClosedGroup = "won" | "lost"

/**
 * Cartão do quadro. `value` já segue a regra do servidor (aberto = valor efetivo, "est." quando
 * `valueIsEstimated`; fechado = só o valor fechado). O "há Xh" usa `lastActivityAt` e, sem
 * atividade, `stageEnteredAt`.
 */
export type DealBoardCard = {
  id: string
  companyId: string
  companyName: string
  companySegment: string | null
  contactName: string | null
  stage: DealStage
  status: DealStatus
  source: DealSource
  ownerUserId: string
  ownerUserName: string
  value: number | null
  valueIsEstimated: boolean
  stageEnteredAt: string
  daysInStage: number
  isStalled: boolean
  lastActivityAt: string | null
  nextTask: { type: ActivityType; dueDate: string; isOverdue: boolean } | null
  /** Data local da organização ("2026-10-01"), sem hora. */
  expectedCloseDate: string | null
  closedAt: string | null
  lostReason: LostReason | null
}

/** `count`/`total` somam a coluna inteira no servidor; `items` é só a página `page`. */
export type DealBoardColumn = {
  stage: DealStage
  count: number
  total: number
  totalHasEstimate: boolean
  page: number
  items: DealBoardCard[]
  hasMore: boolean
}

export type DealBoard = {
  /** Responsável que valeu (null = todos). O SDR sempre recebe o próprio id. */
  ownerUserId: string | null
  periodStartLocal: string
  periodEndLocal: string
  sort: DealBoardSort
  /** As sete etapas ativas, na ordem do funil; ignoram o período. */
  columns: DealBoardColumn[]
  /** Ganhos e perdidos com fechamento no período. */
  closed: { won: DealBoardColumn; lost: DealBoardColumn }
}

export type PipelineFilters = {
  ownerUserId?: string
  allOwners?: boolean
  sources?: DealSource[]
  segments?: string[]
  search?: string
}

/** Datas locais da organização (yyyy-MM-dd, inclusive). Sem período = últimos 30 dias. */
export type PipelinePeriod = { from?: string; to?: string }

export type PipelineKpis = {
  pipelineTotal: number
  /** Pipeline ponderado pela probabilidade histórica de cada etapa; null sem histórico. */
  forecastRevenue: number | null
  openDeals: number
  /** Conversão em coorte, 0–1 (igual a `funnelSummary.pct`). */
  conversionRate: number | null
  averageTicket: number | null
}

export type PipelineSummary = {
  ownerUserId: string | null
  periodStartLocal: string
  periodEndLocal: string
  snapshotAt: string
  kpis: PipelineKpis
  /** Janela anterior de mesmo tamanho; null = "Sem base anterior". */
  previous: PipelineKpis | null
  /** Séries alinhadas por índice com `bucketStarts`; o último ponto é o próprio KPI. */
  sparklines: {
    granularity: "day" | "week"
    bucketStarts: string[]
    pipelineTotal: number[]
    forecastRevenue: (number | null)[]
    openDeals: number[]
    conversionRate: (number | null)[]
    averageTicket: (number | null)[]
  }
  /** Coorte dos negócios criados no período; etapa pulada conta como alcançada. `pctOfTop` 0–1. */
  funnel: { stage: DealStage; reached: number; value: number; pctOfTop: number | null }[]
  funnelSummary: { top: number; won: number; pct: number | null }
}

export type PipelineEvolution = {
  ownerUserId: string | null
  points: {
    /** "2026-06" */
    month: string
    monthEndLocal: string
    /** Mês corrente, lido agora. */
    isPartial: boolean
    pipelineTotal: number
    forecastRevenue: number | null
    openDeals: number
  }[]
}

function pipelineQuery(filters: PipelineFilters, period: PipelinePeriod = {}) {
  const query = new URLSearchParams()
  if (filters.ownerUserId) query.set("ownerUserId", filters.ownerUserId)
  if (filters.allOwners) query.set("allOwners", "true")
  for (const source of filters.sources ?? []) query.append("sources", source)
  for (const segment of filters.segments ?? []) query.append("segments", segment)
  if (filters.search?.trim()) query.set("search", filters.search.trim())
  if (period.from) query.set("from", period.from)
  if (period.to) query.set("to", period.to)
  return query
}

export function getDealBoard(
  params: PipelineFilters & PipelinePeriod & { sort?: DealBoardSort; perColumn?: number },
  signal?: AbortSignal
) {
  const query = pipelineQuery(params, params)
  if (params.sort) query.set("sort", params.sort)
  if (params.perColumn) query.set("perColumn", String(params.perColumn))
  return apiFetch<DealBoard>(`/api/deals/board?${query}`, { signal })
}

/** "Carregar mais" de uma coluna: uma etapa ativa ou um grupo de Fechados. */
export function getDealBoardColumn(
  column: { stage: DealStage } | { closed: DealBoardClosedGroup },
  params: PipelineFilters & PipelinePeriod & { sort?: DealBoardSort; page: number; perColumn?: number },
  signal?: AbortSignal
) {
  const query = pipelineQuery(params, params)
  if ("stage" in column) query.set("stage", column.stage)
  else query.set("closed", column.closed)
  if (params.sort) query.set("sort", params.sort)
  query.set("page", String(params.page))
  if (params.perColumn) query.set("perColumn", String(params.perColumn))
  return apiFetch<DealBoardColumn>(`/api/deals/board/column?${query}`, { signal })
}

export function getPipelineSummary(params: PipelineFilters & PipelinePeriod, signal?: AbortSignal) {
  return apiFetch<PipelineSummary>(`/api/deals/pipeline-summary?${pipelineQuery(params, params)}`, { signal })
}

export function getPipelineEvolution(params: PipelineFilters & { months: 3 | 6 | 12 }, signal?: AbortSignal) {
  const query = pipelineQuery(params)
  query.set("months", String(params.months))
  return apiFetch<PipelineEvolution>(`/api/deals/pipeline-evolution?${query}`, { signal })
}

/**
 * Ficha atual do negócio num 409 de `changeDealStage` com `expectedFromStage` (outro usuário já
 * moveu ou fechou). null para qualquer outro erro.
 */
export function staleDealOf(error: unknown): Deal | null {
  return error instanceof ApiError && error.status === 409 && error.current ? (error.current as Deal) : null
}

export type PagedResult<T> = {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export type DealInput = {
  contactId: string | null
  source: DealSource
  ownerUserId: string
  ticket: number | null
  amount: number | null
  expectedCloseDate: string | null
}

export type CreateDealInput = DealInput & {
  companyId: string
}

/** A organização nunca é enviada: o servidor a resolve pelo token. */
export function listDeals(
  params: {
    companyId?: string
    stage?: DealStage
    ownerUserId?: string
    source?: DealSource
    page?: number
    pageSize?: number
  },
  signal?: AbortSignal
) {
  const query = new URLSearchParams()
  if (params.companyId) query.set("companyId", params.companyId)
  if (params.stage) query.set("stage", params.stage)
  if (params.ownerUserId) query.set("ownerUserId", params.ownerUserId)
  if (params.source) query.set("source", params.source)
  query.set("page", String(params.page ?? 1))
  query.set("pageSize", String(params.pageSize ?? 200))

  return apiFetch<PagedResult<DealListItem>>(`/api/deals?${query}`, { signal })
}

export function getDeal(id: string, signal?: AbortSignal) {
  return apiFetch<Deal>(`/api/deals/${id}`, { signal })
}

export function createDeal(input: CreateDealInput) {
  return apiFetch<Deal>("/api/deals", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateDeal(id: string, input: DealInput) {
  return apiFetch<Deal>(`/api/deals/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  })
}

/**
 * Mesma etapa = sucesso sem nova transição. Com `expectedFromStage`, se o negócio já saiu dela o
 * servidor responde 409 com a ficha atual (ver `staleDealOf`).
 */
export function changeDealStage(id: string, stage: DealStage, options: { expectedFromStage?: DealStage } = {}) {
  return apiFetch<Deal>(`/api/deals/${id}/stage`, {
    method: "POST",
    body: JSON.stringify({ stage, expectedFromStage: options.expectedFromStage ?? null }),
  })
}

/** Igual a `changeDealStage`, mas devolve o cartão do quadro (`?view=card`). */
export function changeDealStageForBoard(id: string, stage: DealStage, options: { expectedFromStage?: DealStage } = {}) {
  return apiFetch<DealBoardCard>(`/api/deals/${id}/stage?view=card`, {
    method: "POST",
    body: JSON.stringify({ stage, expectedFromStage: options.expectedFromStage ?? null }),
  })
}

/** Perdido exige `lostReason`; ganho não aceita motivo nem nota. */
export function closeDeal(
  id: string,
  won: boolean,
  closedAmount: number | null,
  lostReason?: LostReason,
  lostNote?: string
) {
  return apiFetch<Deal>(`/api/deals/${id}/close`, {
    method: "POST",
    body: JSON.stringify({ won, closedAmount, lostReason: lostReason ?? null, lostNote: lostNote?.trim() || null }),
  })
}

export function listUsers(signal?: AbortSignal) {
  return apiFetch<UserSummary[]>("/api/users", { signal })
}
