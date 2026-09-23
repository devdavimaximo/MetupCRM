import type { Page } from "@playwright/test"

import { ConversationStore, expect, gotoConversas, installApi, test } from "./fixtures/app"
import { installHub } from "./fixtures/hub"

/**
 * Tempo real da Inbox (item 25). O hub só diz "isto mudou" — sem o valor novo (ver
 * `RealtimeEventMessage` no back) — então cada evento faz a tela buscar a verdade certa: a thread
 * aberta, o contexto ou só o item da lista, nunca a lista inteira reordenada.
 */
const list = (page: Page) => page.locator('section[aria-label="Conversas"]')
const thread = (page: Page) => page.locator('section[aria-label="Thread da conversa"]')

/** No celular a thread cobre a lista (`hidden lg:flex`): volta para poder checar um item dela. */
async function backToListOnMobile(page: Page) {
  if ((page.viewportSize()?.width ?? 0) >= 1024) return
  await page.getByRole("button", { name: "Voltar para conversas" }).click()
}

async function openLive(page: Page, query = "") {
  const store = new ConversationStore()
  await installApi(page, store.routes())
  const hub = await installHub(page)
  await gotoConversas(page, query)
  await hub.connected
  await expect(page.getByTestId("realtime-indicator")).toHaveAttribute("data-status", "connected")
  return { store, hub }
}

test.describe("mensagem em tempo real", () => {
  test("chega com a thread aberta: entra na hora, realça e marca como lida de novo", async ({ page }) => {
    const { store, hub } = await openLive(page, "&conversa=conv-1")
    await expect(page.getByRole("button", { name: "Ações de Ana Paula" })).toBeVisible()
    // Espera a leitura de abertura (já disparada ao montar a thread) assentar antes de medir a próxima.
    await expect.poll(() => store.readRequests.length).toBeGreaterThanOrEqual(1)
    const readsBefore = store.readRequests.length

    store.receiveMessage("conv-1", "Chegou agora mesmo!")
    hub.send({ type: "conversation.messageReceived", dealId: null, ownerUserId: null, conversationId: "conv-1" })

    await expect(thread(page)).toContainText("Chegou agora mesmo!")
    await expect(page.locator("[data-highlight=true]")).toHaveCount(1)
    // Thread aberta + mensagem inbound: o SDR está olhando agora, então marca como lida de novo.
    await expect.poll(() => store.readRequests.length).toBeGreaterThan(readsBefore)
    // O realce some sozinho.
    await expect(page.locator("[data-highlight=true]")).toHaveCount(0, { timeout: 5_000 })
  })

  test("chega em outra conversa: a thread aberta não muda, só o item da lista", async ({ page }) => {
    const { store, hub } = await openLive(page, "&conversa=conv-1")
    await expect(page.getByRole("button", { name: "Ações de Ana Paula" })).toBeVisible()

    store.receiveMessage("conv-2", "Pode me mandar uma proposta?")
    hub.send({ type: "conversation.messageReceived", dealId: null, ownerUserId: null, conversationId: "conv-2" })

    // A thread continua sendo a de Ana Paula — nada da conversa 2 vaza para ela.
    await expect(page.getByRole("button", { name: "Ações de Ana Paula" })).toBeVisible()
    await expect(thread(page)).not.toContainText("Pode me mandar uma proposta?")

    await backToListOnMobile(page)
    const brunoItem = list(page).getByRole("button", { name: /Bruno Lima/ })
    await expect(brunoItem).toContainText("Pode me mandar uma proposta?")
    await expect(brunoItem.getByText("Não lida")).toBeVisible()
  })
})

test.describe("status e favorito em tempo real", () => {
  test("status muda em outra aba: o badge da thread aberta acompanha", async ({ page }) => {
    const { store, hub } = await openLive(page, "&conversa=conv-1")
    await expect(page.getByRole("button", { name: "Ações de Ana Paula" })).toBeVisible()
    await expect(page.getByText("Aberta")).toBeVisible()

    store.find("conv-1").status = "Resolvida"
    hub.send({ type: "conversation.statusChanged", dealId: null, ownerUserId: null, conversationId: "conv-1" })

    await expect(page.getByText("Resolvida")).toBeVisible()
  })

  test("favoritada em outra aba: a estrela sincroniza sem recarregar a lista inteira", async ({ page }) => {
    const { store, hub } = await openLive(page)
    await expect(list(page).getByRole("button", { name: /Ana Paula/ })).toBeVisible()

    store.find("conv-1").isFavorite = true
    hub.send({ type: "conversation.favorited", dealId: null, ownerUserId: null, conversationId: "conv-1" })

    await expect(list(page).getByRole("button", { name: /Ana Paula/ }).getByText("Favorita")).toBeVisible()
    await expect(page.getByRole("tab", { name: /Favoritas\s*2/ })).toBeVisible()
  })

  test("desfavoritada em outra aba enquanto a aba Favoritas está aberta: sai da lista", async ({ page }) => {
    const { store, hub } = await openLive(page)
    await page.getByRole("tab", { name: /Favoritas/ }).click()
    await expect(list(page).getByRole("button", { name: /Bruno Lima/ })).toBeVisible()

    store.find("conv-2").isFavorite = false
    hub.send({ type: "conversation.favorited", dealId: null, ownerUserId: null, conversationId: "conv-2" })

    await expect(list(page).getByRole("button", { name: /Bruno Lima/ })).toHaveCount(0)
    await expect(page.getByRole("tab", { name: /Favoritas\s*0/ })).toBeVisible()
  })
})
