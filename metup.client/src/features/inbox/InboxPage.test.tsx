import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import * as inboxApi from "./api"
import type { ConversationContext, ConversationListItem } from "./api"
import { InboxPage } from "./InboxPage"

const baseItem: ConversationListItem = {
  id: "conv-1",
  contactId: "ct-1",
  contactName: "Ana Paula",
  companyId: "co-1",
  companyName: "Tech Solutions",
  lastMessagePreview: "Olá, tudo bem?",
  lastMessageAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  channel: "WhatsApp",
  status: "Aberta",
  isUnread: false,
  isFavorite: true,
  tags: ["VIP"],
}

const baseContext: ConversationContext = {
  contactId: "ct-1",
  contactName: "Ana Paula",
  contactRole: null,
  contactPhone: null,
  contactWhatsApp: "+55 11 90000-0000",
  contactEmail: null,
  companyId: "co-1",
  companyName: "Tech Solutions",
  dealId: "deal-1",
  dealStage: "Qualificacao",
  dealStatus: "Aberto",
  dealTicket: 5000,
  dealAmount: null,
  channel: "WhatsApp",
  status: "Aberta",
  automationEnabled: false,
  tags: ["VIP"],
  companyCnpj: null,
  companyWebsite: null,
  companySegment: null,
  companyCity: null,
  dealOwnerUserName: null,
  summary: { totalMessages: 2, averageResponseTimeMinutes: null, lastInteractionAt: null },
}

function mockBaseApi(item: ConversationListItem = baseItem, context: ConversationContext = baseContext) {
  vi.spyOn(inboxApi, "listConversations").mockResolvedValue({ items: [item], page: 1, pageSize: 50, totalCount: 1, totalPages: 1 })
  vi.spyOn(inboxApi, "getConversationsSummary").mockResolvedValue({ total: 1, unread: 0, favorite: 1 })
  vi.spyOn(inboxApi, "listMessages").mockResolvedValue([])
  vi.spyOn(inboxApi, "getConversationContext").mockResolvedValue(context)
  vi.spyOn(inboxApi, "markConversationRead").mockResolvedValue(undefined)
  vi.spyOn(inboxApi, "listConversationTagOptions").mockResolvedValue([{ id: "tag-vip", name: "VIP" }])
  vi.spyOn(inboxApi, "getActivityHistory").mockResolvedValue({ items: [], nextCursor: null })
}

// `writeUrlState` grava em `window.location` via `history.replaceState`, que persiste entre testes
// do mesmo arquivo (o jsdom não reseta a URL sozinho) — sem isso, a conversa selecionada no teste
// anterior "vaza" como `?conversa=` para o próximo.
beforeEach(() => window.history.replaceState(null, "", "/"))
afterEach(() => vi.restoreAllMocks())

async function openConversation() {
  const user = userEvent.setup()
  render(<InboxPage onOpenDeal={vi.fn()} onOpenCompany={vi.fn()} />)
  await user.click(await screen.findByRole("button", { name: /Ana Paula/ }))
  await screen.findByRole("button", { name: /Ações de Ana Paula/ })
  return user
}

describe("favoritar — otimista com reversão em erro", () => {
  it("desfavoritar aplica na hora e volta a favorito se o servidor recusar", async () => {
    mockBaseApi()
    vi.spyOn(inboxApi, "unfavoriteConversation").mockRejectedValue(new Error("falhou"))
    const user = await openConversation()

    // Estrela visível de início (isFavorite: true).
    expect(screen.getAllByText("Favorita").length).toBeGreaterThan(0)

    await user.click(screen.getByRole("button", { name: /Ações de Ana Paula/ }))
    await user.click(screen.getByText("Desfavoritar"))

    await screen.findByText("Não foi possível favoritar a conversa.")
    // Revertida: a conversa continua favorita depois do erro.
    expect(screen.getAllByText("Favorita").length).toBeGreaterThan(0)
  })
})

describe("automação — otimista com reversão em erro", () => {
  it("tenta ligar (otimista) e volta a desligado quando o servidor recusa", async () => {
    mockBaseApi()
    const setAutomation = vi.spyOn(inboxApi, "setConversationAutomation").mockRejectedValue(new Error("falhou"))
    const user = await openConversation()

    const toggle = await screen.findByRole("switch", { name: "Ativar automação" })
    expect(toggle).not.toBeChecked()

    await user.click(toggle)

    // A rejeição já mockada resolve no mesmo ciclo de microtarefas do clique — o que dá para observar
    // de fora é a tentativa (o valor que pediu) e o estado final revertido, não o instante intermediário.
    expect(setAutomation).toHaveBeenCalledWith("conv-1", true)
    await screen.findByText("Não foi possível atualizar a automação.")
    expect(toggle).not.toBeChecked()
  })
})

describe("tags — otimista com reversão em erro", () => {
  it("remover uma tag aplicada some na hora e volta se o servidor recusar", async () => {
    mockBaseApi()
    vi.spyOn(inboxApi, "removeConversationTag").mockRejectedValue(new Error("falhou"))
    const user = await openConversation()

    expect(await screen.findByText("VIP")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Remover tag VIP" }))

    await screen.findByText("Não foi possível remover a tag.")
    // Revertida: a tag volta a aparecer depois do erro.
    expect(await screen.findByText("VIP")).toBeInTheDocument()
  })
})
