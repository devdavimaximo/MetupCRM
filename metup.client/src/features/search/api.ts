import { apiFetch } from "@/lib/api"
import type { DealStage, DealStatus } from "@/features/deals/api"

export type CompanySearchHit = { id: string; name: string; segment: string | null; city: string | null }
export type ContactSearchHit = { id: string; name: string; companyId: string; companyName: string; role: string | null }
/** `amount` é o valor efetivo: valor em negociação ou, na falta dele, o ticket. */
export type DealSearchHit = {
  id: string
  companyId: string
  companyName: string
  stage: DealStage
  status: DealStatus
  amount: number | null
  ownerUserName: string | null
}

export type SearchResult = { companies: CompanySearchHit[]; contacts: ContactSearchHit[]; deals: DealSearchHit[] }

export const MIN_SEARCH_LENGTH = 2

/** Até 5 de cada tipo, sem diferenciar maiúsculas nem acentos. Negócios seguem o escopo do papel. */
export function search(term: string, signal?: AbortSignal) {
  return apiFetch<SearchResult>(`/api/search?q=${encodeURIComponent(term)}`, { signal })
}
