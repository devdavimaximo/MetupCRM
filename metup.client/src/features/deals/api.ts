import { apiFetch } from "@/lib/api"

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

export function changeDealStage(id: string, stage: DealStage) {
  return apiFetch<Deal>(`/api/deals/${id}/stage`, {
    method: "POST",
    body: JSON.stringify({ stage }),
  })
}

export function closeDeal(id: string, won: boolean, closedAmount: number | null) {
  return apiFetch<Deal>(`/api/deals/${id}/close`, {
    method: "POST",
    body: JSON.stringify({ won, closedAmount }),
  })
}

export function listUsers(signal?: AbortSignal) {
  return apiFetch<UserSummary[]>("/api/users", { signal })
}
