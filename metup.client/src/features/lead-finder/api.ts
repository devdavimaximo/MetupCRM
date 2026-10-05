import { apiFetch } from "@/lib/api"

/** Mesmos nomes dos enums do servidor. */
export type LeadSearchStatus = "Requested" | "Running" | "Completed" | "Failed" | "Cancelled"
export type LeadSearchOrigin = "Crm" | "Automation"
export type FoundLeadStatus = "New" | "Imported" | "Discarded"
export type FoundLeadSort = "Rating" | "Reviews" | "Name" | "Recent"

export type LeadSearch = {
  id: string
  query: string
  location: string | null
  maxResults: number | null
  status: LeadSearchStatus
  origin: LeadSearchOrigin
  requestedByUserId: string | null
  requestedByName: string | null
  requestedAt: string
  startedAt: string | null
  finishedAt: string | null
  lastActivityAt: string
  receivedCount: number
  newCount: number
  errorMessage: string | null
  /** A automação não pegou (ou abandonou) a busca: a tela oferece reenviar ou cancelar. */
  isStalled: boolean
}

export type FoundLead = {
  id: string
  leadSearchId: string
  name: string
  category: string | null
  phone: string | null
  website: string | null
  email: string | null
  instagram: string | null
  address: string | null
  city: string | null
  state: string | null
  rating: number | null
  reviewCount: number | null
  mapsUrl: string | null
  status: FoundLeadStatus
  /** Telefone já pertence a uma empresa cadastrada — importar reaproveita a empresa. */
  existingCompanyId: string | null
  companyId: string | null
  dealId: string | null
  foundAt: string
}

export type FoundLeadCounts = { new: number; imported: number; discarded: number }

export type FoundLeadPage = {
  items: FoundLead[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  counts: FoundLeadCounts
}

export type FoundLeadFilters = {
  searchId: string | null
  status: FoundLeadStatus
  search: string
  hasPhone: boolean | null
  hasWebsite: boolean | null
  minRating: number | null
  sort: FoundLeadSort
  page: number
  pageSize: number
}

export type LeadFinderSettings = { webhookUrl: string | null; serviceTokenConfigured: boolean }

export function listLeadSearches(signal?: AbortSignal) {
  return apiFetch<LeadSearch[]>("/api/lead-finder/searches?limit=30", { signal })
}

export function requestLeadSearch(input: { query: string; location: string | null; maxResults: number | null }) {
  return apiFetch<LeadSearch>("/api/lead-finder/searches", { method: "POST", body: JSON.stringify(input) })
}

export function cancelLeadSearch(id: string) {
  return apiFetch<LeadSearch>(`/api/lead-finder/searches/${id}/cancel`, { method: "POST" })
}

export function retryLeadSearch(id: string) {
  return apiFetch<LeadSearch>(`/api/lead-finder/searches/${id}/retry`, { method: "POST" })
}

export function listFoundLeads(filters: FoundLeadFilters, signal?: AbortSignal) {
  const query = new URLSearchParams()
  if (filters.searchId) query.set("searchId", filters.searchId)
  query.set("status", filters.status)
  if (filters.search) query.set("search", filters.search)
  if (filters.hasPhone !== null) query.set("hasPhone", String(filters.hasPhone))
  if (filters.hasWebsite !== null) query.set("hasWebsite", String(filters.hasWebsite))
  if (filters.minRating !== null) query.set("minRating", String(filters.minRating))
  query.set("sort", filters.sort)
  query.set("page", String(filters.page))
  query.set("pageSize", String(filters.pageSize))

  return apiFetch<FoundLeadPage>(`/api/lead-finder/leads?${query}`, { signal })
}

export type ImportResult = { imported: number; skipped: number; dealIds: string[] }

export function importFoundLeads(input: { ids: string[]; ownerUserId: string | null; scheduleCall: boolean }) {
  return apiFetch<ImportResult>("/api/lead-finder/leads/import", { method: "POST", body: JSON.stringify(input) })
}

export function triageFoundLeads(input: { ids: string[]; action: "Discard" | "Restore" }) {
  return apiFetch<{ changed: number }>("/api/lead-finder/leads/triage", { method: "POST", body: JSON.stringify(input) })
}

export function getLeadFinderSettings(signal?: AbortSignal) {
  return apiFetch<LeadFinderSettings>("/api/lead-finder/settings", { signal })
}

export function updateLeadFinderSettings(webhookUrl: string | null) {
  return apiFetch<LeadFinderSettings>("/api/lead-finder/settings", { method: "PUT", body: JSON.stringify({ webhookUrl }) })
}

/** Substitui o service token do n8n. O texto puro volta uma única vez — o token antigo para de valer. */
export function rotateServiceToken() {
  return apiFetch<{ token: string }>("/api/integrations/service-token/rotate", { method: "POST" })
}
