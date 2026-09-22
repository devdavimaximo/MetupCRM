import { apiFetch } from "@/lib/api"
import type { DealStage, DealStatus } from "@/features/deals/api"
import type { RecentEvent } from "@/features/dashboard/api"

export type MessageDirection = "Inbound" | "Outbound"
export type ConversationChannel = "WhatsApp"
export type ConversationStatus = "Aberta" | "Pendente" | "Resolvida"
export type MessageAuthorKind = "Sdr" | "Bot"
export type MessageAttachmentKind = "Image" | "Video" | "Document" | "Audio"

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
  channel: ConversationChannel
  status: ConversationStatus
  isUnread: boolean
  isFavorite: boolean
  tags: string[]
}

export type MessageAttachment = {
  kind: MessageAttachmentKind
  url: string
  fileName: string | null
  mimeType: string | null
  sizeBytes: number | null
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
  authorKind: MessageAuthorKind | null
  attachments: MessageAttachment[]
}

export type ConversationSummary = {
  totalMessages: number
  averageResponseTimeMinutes: number | null
  lastInteractionAt: string | null
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
  channel: ConversationChannel
  status: ConversationStatus
  automationEnabled: boolean
  tags: string[]
  companyCnpj: string | null
  companyWebsite: string | null
  companySegment: string | null
  companyCity: string | null
  dealOwnerUserName: string | null
  summary: ConversationSummary
}

export type ConversationCounts = {
  total: number
  unread: number
  favorite: number
}

export type ConversationTagOption = {
  id: string
  name: string
}

/** A organização nunca é enviada: o servidor a resolve pelo token. */
export function listConversations(
  params: {
    search?: string
    channel?: ConversationChannel[]
    status?: ConversationStatus[]
    unread?: boolean
    favorite?: boolean
    page?: number
    pageSize?: number
  },
  signal?: AbortSignal
) {
  const query = new URLSearchParams()
  if (params.search) query.set("search", params.search)
  for (const channel of params.channel ?? []) query.append("channel", channel)
  for (const status of params.status ?? []) query.append("status", status)
  if (params.unread !== undefined) query.set("unread", String(params.unread))
  if (params.favorite !== undefined) query.set("favorite", String(params.favorite))
  query.set("page", String(params.page ?? 1))
  query.set("pageSize", String(params.pageSize ?? 50))

  return apiFetch<PagedResult<ConversationListItem>>(`/api/conversations?${query}`, { signal })
}

export function getConversationsSummary(signal?: AbortSignal) {
  return apiFetch<ConversationCounts>(`/api/conversations/summary`, { signal })
}

export function listConversationTagOptions(search?: string, signal?: AbortSignal) {
  const query = new URLSearchParams()
  if (search) query.set("search", search)
  return apiFetch<ConversationTagOption[]>(`/api/conversations/tag-options?${query}`, { signal })
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

export function updateConversationStatus(conversationId: string, status: ConversationStatus) {
  return apiFetch<void>(`/api/conversations/${conversationId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  })
}

export function markConversationRead(conversationId: string) {
  return apiFetch<void>(`/api/conversations/${conversationId}/read`, { method: "POST" })
}

export function markConversationUnread(conversationId: string) {
  return apiFetch<void>(`/api/conversations/${conversationId}/read`, { method: "DELETE" })
}

export function favoriteConversation(conversationId: string) {
  return apiFetch<void>(`/api/conversations/${conversationId}/favorite`, { method: "POST" })
}

export function unfavoriteConversation(conversationId: string) {
  return apiFetch<void>(`/api/conversations/${conversationId}/favorite`, { method: "DELETE" })
}

export function applyConversationTag(conversationId: string, name: string) {
  return apiFetch<void>(`/api/conversations/${conversationId}/tags`, {
    method: "POST",
    body: JSON.stringify({ name }),
  })
}

export function removeConversationTag(conversationId: string, tagOptionId: string) {
  return apiFetch<void>(`/api/conversations/${conversationId}/tags/${tagOptionId}`, { method: "DELETE" })
}

export function setConversationAutomation(conversationId: string, enabled: boolean) {
  return apiFetch<void>(`/api/conversations/${conversationId}/automation`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  })
}

/** Os 5 últimos eventos do negócio (atividade + transição de estágio), sem filtro de tipo (item 20). */
export function getActivityHistory(dealId: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ dealId, pageSize: "5" })
  return apiFetch<{ items: RecentEvent[]; nextCursor: string | null }>(`/api/activity-feed?${query}`, { signal })
}
