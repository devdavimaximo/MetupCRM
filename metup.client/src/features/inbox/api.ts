import { apiFetch } from "@/lib/api"
import type { DealStage, DealStatus } from "@/features/deals/api"

export type MessageDirection = "Inbound" | "Outbound"

export type PagedResult<T> = {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export type ConversationListItem = {
  id: string
  contactId: string
  contactName: string
  companyId: string
  companyName: string
  lastMessagePreview: string | null
  lastMessageAt: string | null
  createdAt: string
}

export type Message = {
  id: string
  conversationId: string
  direction: MessageDirection
  body: string
  authorUserId: string | null
  authorUserName: string | null
  dealId: string | null
  dealStageAtMessage: DealStage | null
  occurredAt: string
}

export type ConversationContext = {
  contactId: string
  contactName: string
  contactRole: string | null
  contactPhone: string | null
  contactWhatsApp: string | null
  contactEmail: string | null
  companyId: string
  companyName: string
  dealId: string | null
  dealStage: DealStage | null
  dealStatus: DealStatus | null
  dealTicket: number | null
  dealAmount: number | null
}

/** A organização nunca é enviada: o servidor a resolve pelo token. */
export function listConversations(
  params: { search?: string; page?: number; pageSize?: number },
  signal?: AbortSignal
) {
  const query = new URLSearchParams()
  if (params.search) query.set("search", params.search)
  query.set("page", String(params.page ?? 1))
  query.set("pageSize", String(params.pageSize ?? 50))

  return apiFetch<PagedResult<ConversationListItem>>(`/api/conversations?${query}`, { signal })
}

export function listMessages(conversationId: string, signal?: AbortSignal) {
  return apiFetch<Message[]>(`/api/conversations/${conversationId}/messages`, { signal })
}

export function getConversationContext(conversationId: string, signal?: AbortSignal) {
  return apiFetch<ConversationContext>(`/api/conversations/${conversationId}/context`, { signal })
}

export function sendMessage(conversationId: string, body: string) {
  return apiFetch<Message>(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  })
}
