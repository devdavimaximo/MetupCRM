/**
 * A Inbox dublada **com estado** (onda C4): listar, contexto, mensagens, status, automação, ler/
 * favoritar e tags mudam a loja de verdade — o mesmo espírito do `BoardStore` do Pipeline. Serve
 * tanto o funcional (`conversas-page.spec.ts`) quanto o tempo real (`conversas-realtime.spec.ts`,
 * que empurra mensagens via `receiveMessage` + o hub dublado de `fixtures/hub.ts`).
 */

import type { DealStage, DealStatus } from "@/features/deals/api"
import type {
  ConversationChannel,
  ConversationContext,
  ConversationCounts,
  ConversationListItem,
  ConversationStatus,
  ConversationTagOption,
  Message,
} from "@/features/inbox/api"
import type { Handler } from "./app"

type ConversationRecord = {
  id: string
  contactId: string
  contactName: string
  contactRole: string | null
  contactPhone: string | null
  contactWhatsApp: string | null
  contactEmail: string | null
  companyId: string
  companyName: string
  companyCnpj: string | null
  companyWebsite: string | null
  companySegment: string | null
  companyCity: string | null
  dealId: string | null
  dealStage: DealStage | null
  dealStatus: DealStatus | null
  dealTicket: number | null
  dealAmount: number | null
  dealOwnerUserName: string | null
  channel: ConversationChannel
  status: ConversationStatus
  automationEnabled: boolean
  isFavorite: boolean
  isUnread: boolean
  tags: string[]
  messages: Message[]
}

let messageSeq = 0
function nextMessageId() {
  messageSeq += 1
  return `msg-${messageSeq}`
}

function message(
  patch: Partial<Message> & Pick<Message, "conversationId" | "direction" | "body" | "occurredAt">
): Message {
  return {
    id: nextMessageId(),
    authorUserId: null,
    authorUserName: null,
    dealId: null,
    dealStageAtMessage: null,
    authorKind: patch.direction === "Outbound" ? "Sdr" : null,
    attachments: [],
    ...patch,
  }
}

function seed(): ConversationRecord[] {
  return [
    {
      id: "conv-1",
      contactId: "contact-1",
      contactName: "Ana Paula",
      contactRole: "Compradora",
      contactPhone: null,
      contactWhatsApp: "+55 11 90000-0001",
      contactEmail: "ana@techsolutions.test",
      companyId: "company-1",
      companyName: "Tech Solutions",
      companyCnpj: "12.345.678/0001-90",
      companyWebsite: "techsolutions.test",
      companySegment: "Serviços",
      companyCity: "Curitiba",
      dealId: "deal-1",
      dealStage: "Negociacao",
      dealStatus: "Aberto",
      dealTicket: null,
      dealAmount: 24_000,
      dealOwnerUserName: "Davi Maximo",
      channel: "WhatsApp",
      status: "Aberta",
      automationEnabled: false,
      isFavorite: false,
      isUnread: true,
      tags: [],
      messages: [
        message({ conversationId: "conv-1", direction: "Inbound", body: "Olá, tudo bem?", occurredAt: "2026-09-15T12:00:00Z" }),
        message({
          conversationId: "conv-1",
          direction: "Outbound",
          body: "Oi! Tudo sim, e você?",
          occurredAt: "2026-09-15T12:05:00Z",
          authorUserId: "u-1",
          authorUserName: "Davi Maximo",
        }),
      ],
    },
    {
      id: "conv-2",
      contactId: "contact-2",
      contactName: "Bruno Lima",
      contactRole: null,
      contactPhone: "+55 41 90000-0002",
      contactWhatsApp: null,
      contactEmail: null,
      companyId: "company-2",
      companyName: "Mercado Bonfim",
      companyCnpj: null,
      companyWebsite: null,
      companySegment: "Varejo",
      companyCity: "Curitiba",
      dealId: null,
      dealStage: null,
      dealStatus: null,
      dealTicket: null,
      dealAmount: null,
      dealOwnerUserName: null,
      channel: "WhatsApp",
      status: "Pendente",
      automationEnabled: true,
      isFavorite: true,
      isUnread: false,
      tags: ["VIP"],
      messages: [
        message({ conversationId: "conv-2", direction: "Inbound", body: "Quero saber mais sobre o produto.", occurredAt: "2026-09-14T09:00:00Z" }),
      ],
    },
    {
      id: "conv-3",
      contactId: "contact-3",
      contactName: "Clara Souza",
      contactRole: "Gerente",
      contactPhone: null,
      contactWhatsApp: "+55 41 90000-0003",
      contactEmail: null,
      companyId: "company-3",
      companyName: "Clínica Vitória",
      companyCnpj: null,
      companyWebsite: null,
      companySegment: "Saúde",
      companyCity: "Curitiba",
      dealId: "deal-3",
      dealStage: "Reuniao",
      dealStatus: "Aberto",
      dealTicket: 6_000,
      dealAmount: null,
      dealOwnerUserName: "Davi Maximo",
      channel: "WhatsApp",
      status: "Resolvida",
      automationEnabled: false,
      isFavorite: false,
      isUnread: false,
      tags: [],
      messages: [
        message({ conversationId: "conv-3", direction: "Inbound", body: "Obrigada pelo atendimento!", occurredAt: "2026-09-10T09:00:00Z" }),
      ],
    },
  ]
}

export class ConversationStore {
  conversations: ConversationRecord[] = seed()
  tagCatalog: ConversationTagOption[] = [
    { id: "tag-vip", name: "VIP" },
    { id: "tag-urgente", name: "Urgente" },
  ]

  listRequests: URLSearchParams[] = []
  statusRequests: { id: string; status: ConversationStatus }[] = []
  automationRequests: { id: string; enabled: boolean }[] = []
  tagApplyRequests: { id: string; name: string }[] = []
  tagRemoveRequests: { id: string; tagOptionId: string }[] = []
  readRequests: { id: string; method: string }[] = []
  favoriteRequests: { id: string; method: string }[] = []
  sendRequests: { id: string; body: string }[] = []

  find(id: string) {
    const conversation = this.conversations.find((c) => c.id === id)
    if (!conversation) throw new Error(`conversa ${id} não existe na loja de teste`)
    return conversation
  }

  private toListItem(c: ConversationRecord): ConversationListItem {
    const last = c.messages.at(-1) ?? null
    return {
      id: c.id,
      contactId: c.contactId,
      contactName: c.contactName,
      companyId: c.companyId,
      companyName: c.companyName,
      lastMessagePreview: last?.body ?? null,
      lastMessageAt: last?.occurredAt ?? null,
      createdAt: c.messages[0]?.occurredAt ?? "2026-09-01T00:00:00Z",
      channel: c.channel,
      status: c.status,
      isUnread: c.isUnread,
      isFavorite: c.isFavorite,
      tags: [...c.tags],
    }
  }

  private toContext(c: ConversationRecord): ConversationContext {
    const inbound = c.messages.filter((m) => m.direction === "Inbound")
    const outbound = c.messages.filter((m) => m.direction === "Outbound")
    let totalWaitMinutes = 0
    let pairs = 0
    for (const received of inbound) {
      const reply = outbound.find((out) => new Date(out.occurredAt) > new Date(received.occurredAt))
      if (reply) {
        totalWaitMinutes += (new Date(reply.occurredAt).getTime() - new Date(received.occurredAt).getTime()) / 60_000
        pairs += 1
      }
    }
    return {
      contactId: c.contactId,
      contactName: c.contactName,
      contactRole: c.contactRole,
      contactPhone: c.contactPhone,
      contactWhatsApp: c.contactWhatsApp,
      contactEmail: c.contactEmail,
      companyId: c.companyId,
      companyName: c.companyName,
      dealId: c.dealId,
      dealStage: c.dealStage,
      dealStatus: c.dealStatus,
      dealTicket: c.dealTicket,
      dealAmount: c.dealAmount,
      channel: c.channel,
      status: c.status,
      automationEnabled: c.automationEnabled,
      tags: [...c.tags],
      companyCnpj: c.companyCnpj,
      companyWebsite: c.companyWebsite,
      companySegment: c.companySegment,
      companyCity: c.companyCity,
      dealOwnerUserName: c.dealOwnerUserName,
      summary: {
        totalMessages: c.messages.length,
        averageResponseTimeMinutes: pairs > 0 ? totalWaitMinutes / pairs : null,
        lastInteractionAt: c.messages.at(-1)?.occurredAt ?? null,
      },
    }
  }

  list: Handler = (route) => {
    const params = new URL(route.request().url()).searchParams
    this.listRequests.push(params)
    const search = params.get("search")?.toLowerCase()
    const channels = params.getAll("channel")
    const statuses = params.getAll("status")
    const unread = params.get("unread") === "true"
    const favorite = params.get("favorite") === "true"
    const page = Number(params.get("page") ?? 1)
    const pageSize = Number(params.get("pageSize") ?? 50)

    const filtered = this.conversations.filter((c) => {
      if (search && !c.contactName.toLowerCase().includes(search) && !c.companyName.toLowerCase().includes(search)) return false
      if (channels.length > 0 && !channels.includes(c.channel)) return false
      if (statuses.length > 0 && !statuses.includes(c.status)) return false
      if (unread && !c.isUnread) return false
      if (favorite && !c.isFavorite) return false
      return true
    })
    const sorted = [...filtered].sort((a, b) => (b.messages.at(-1)?.occurredAt ?? "").localeCompare(a.messages.at(-1)?.occurredAt ?? ""))
    const start = (page - 1) * pageSize
    const items = sorted.slice(start, start + pageSize).map((c) => this.toListItem(c))
    return { items, page, pageSize, totalCount: sorted.length, totalPages: Math.max(1, Math.ceil(sorted.length / pageSize)) }
  }

  summary: Handler = (): ConversationCounts => ({
    total: this.conversations.length,
    unread: this.conversations.filter((c) => c.isUnread).length,
    favorite: this.conversations.filter((c) => c.isFavorite).length,
  })

  tagOptions: Handler = (route) => {
    const search = new URL(route.request().url()).searchParams.get("search")?.toLowerCase()
    return this.tagCatalog.filter((t) => !search || t.name.toLowerCase().includes(search))
  }

  messages: Handler = (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2)!
    const conversation = this.find(id)
    if (route.request().method() === "POST") {
      const body = JSON.parse(route.request().postData() ?? "{}") as { body: string }
      this.sendRequests.push({ id, body: body.body })
      const sent = message({
        conversationId: id,
        direction: "Outbound",
        body: body.body,
        occurredAt: new Date().toISOString(),
        authorUserId: "u-1",
        authorUserName: "Davi Maximo",
      })
      conversation.messages.push(sent)
      return sent
    }
    return conversation.messages
  }

  context: Handler = (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2)!
    return this.toContext(this.find(id))
  }

  status: Handler = (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2)!
    const body = JSON.parse(route.request().postData() ?? "{}") as { status: ConversationStatus }
    this.statusRequests.push({ id, status: body.status })
    this.find(id).status = body.status
    return {}
  }

  automation: Handler = (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2)!
    const body = JSON.parse(route.request().postData() ?? "{}") as { enabled: boolean }
    this.automationRequests.push({ id, enabled: body.enabled })
    this.find(id).automationEnabled = body.enabled
    return {}
  }

  read: Handler = (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2)!
    const method = route.request().method()
    this.readRequests.push({ id, method })
    this.find(id).isUnread = method === "DELETE"
    return {}
  }

  favorite: Handler = (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2)!
    const method = route.request().method()
    this.favoriteRequests.push({ id, method })
    this.find(id).isFavorite = method === "POST"
    return {}
  }

  tagsApply: Handler = (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2)!
    const body = JSON.parse(route.request().postData() ?? "{}") as { name: string }
    this.tagApplyRequests.push({ id, name: body.name })
    const conversation = this.find(id)
    if (!conversation.tags.some((t) => t.toLowerCase() === body.name.toLowerCase())) conversation.tags.push(body.name)
    if (!this.tagCatalog.some((t) => t.name.toLowerCase() === body.name.toLowerCase())) {
      this.tagCatalog.push({ id: `tag-${this.tagCatalog.length + 1}`, name: body.name })
    }
    return {}
  }

  tagsRemove: Handler = (route) => {
    const parts = new URL(route.request().url()).pathname.split("/")
    const tagOptionId = parts.at(-1)!
    const id = parts.at(-3)!
    this.tagRemoveRequests.push({ id, tagOptionId })
    const name = this.tagCatalog.find((t) => t.id === tagOptionId)?.name
    if (name) {
      const conversation = this.find(id)
      conversation.tags = conversation.tags.filter((t) => t.toLowerCase() !== name.toLowerCase())
    }
    return {}
  }

  routes() {
    return {
      conversations: this.list,
      conversationsSummary: this.summary,
      conversationTagOptions: this.tagOptions,
      conversationMessages: this.messages,
      conversationContext: this.context,
      conversationStatus: this.status,
      conversationAutomation: this.automation,
      conversationRead: this.read,
      conversationFavorite: this.favorite,
      conversationTagsApply: this.tagsApply,
      conversationTagsRemove: this.tagsRemove,
    }
  }

  /** Uma mensagem inbound nova (item 25): usada pelos testes de tempo real. */
  receiveMessage(conversationId: string, body: string, occurredAt = new Date().toISOString()) {
    const conversation = this.find(conversationId)
    const received = message({ conversationId, direction: "Inbound", body, occurredAt })
    conversation.messages.push(received)
    conversation.isUnread = true
    return received
  }
}
