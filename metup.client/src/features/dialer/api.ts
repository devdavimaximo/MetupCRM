import { apiFetch } from "@/lib/api"
import type { ActivityOutcome } from "@/features/activities/api"
import type { DealSource, DealStage } from "@/features/deals/api"

/** Mesmos nomes dos enums do servidor. */
export type PhoneLineKind = "Device"
export type DialerPhoneKind = "Contact" | "ContactWhatsApp" | "Company"

export type PhoneLine = {
  id: string
  userId: string
  userName: string
  kind: PhoneLineKind
  label: string
  number: string
  numberE164: string
  isDefault: boolean
  isActive: boolean
  createdAt: string
}

export type DialerPhone = {
  kind: DialerPhoneKind
  display: string
  /** O que vai no `tel:` (E.164 ou número de serviço). Nulo = não discável. */
  dial: string | null
}

export type DialerQueueItem = {
  taskId: string
  dueDate: string
  isOverdue: boolean
  taskNote: string | null
  dealId: string
  stage: DealStage
  source: DealSource
  companyId: string
  companyName: string
  segment: string | null
  city: string | null
  website: string | null
  instagram: string | null
  contactId: string | null
  contactName: string | null
  contactRole: string | null
  phones: DialerPhone[]
  callHistory: { attempts: number; lastOutcome: ActivityOutcome | null; lastCallAt: string | null }
  lead: {
    leadSearchId: string
    searchQuery: string
    searchLocation: string | null
    category: string | null
    rating: number | null
    reviewCount: number | null
    address: string | null
    mapsUrl: string | null
  } | null
}

export type DialerQueue = {
  items: DialerQueueItem[]
  totalCount: number
  referenceDate: string
  generatedAt: string
}

export function getDialerQueue(signal?: AbortSignal) {
  return apiFetch<DialerQueue>("/api/dialer/queue", { signal })
}

/** As linhas ativas do usuário logado, a principal primeiro. */
export function listMyPhoneLines(signal?: AbortSignal) {
  return apiFetch<PhoneLine[]>("/api/dialer/lines", { signal })
}

// ── Administração (PhoneLinesManage) ────────────────────────────────────────────

export function listPhoneLines(signal?: AbortSignal) {
  return apiFetch<PhoneLine[]>("/api/phone-lines", { signal })
}

export function createPhoneLine(input: { userId: string; kind: PhoneLineKind; label: string; number: string; isDefault: boolean }) {
  return apiFetch<PhoneLine>("/api/phone-lines", { method: "POST", body: JSON.stringify(input) })
}

export function updatePhoneLine(id: string, input: { label: string; number: string; makeDefault: boolean }) {
  return apiFetch<PhoneLine>(`/api/phone-lines/${id}`, { method: "PUT", body: JSON.stringify(input) })
}

export function setPhoneLineActive(id: string, isActive: boolean) {
  return apiFetch<PhoneLine>(`/api/phone-lines/${id}/active`, { method: "PUT", body: JSON.stringify({ isActive }) })
}
