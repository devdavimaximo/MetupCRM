import type { Page } from "@playwright/test"

import { ConversationStore, expect, gotoConversas, installApi, test } from "./fixtures/app"

/** Abaixo de `lg` a thread cobre a lista (mestre-detalhe) — o mesmo ponto de corte do grid. */
const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024

/**
 * Escopado à seção da lista: uma vez que uma thread está aberta, o cabeçalho dela também tem um
 * botão "Ações de <nome>" que casaria com o mesmo nome em busca por regex — a lista é a fonte
 * inequívoca de "o item desta conversa".
 */
const list = (page: Page) => page.locator('section[aria-label="Conversas"]')

async function open(page: Page, store = new ConversationStore(), query = "") {
  await installApi(page, store.routes())
  await gotoConversas(page, query)
  await expect(list(page).getByRole("button", { name: /Ana Paula/ })).toBeVisible()
  return store
}

/**
 * No celular a thread cobre a lista (`hidden lg:flex`): um elemento `display:none` não entra em
 * nenhuma busca por `role`, então as abas ficam inencontráveis até voltar. Os testes de contagem
 * reabrem a lista antes de checar a aba — o pedido ao servidor já foi conferido antes disso.
 */
async function backToListOnMobile(page: Page) {
  if (!isMobile(page)) return
  await page.getByRole("button", { name: "Voltar para conversas" }).click()
}

test.describe("lista e filtros", () => {
  test("abas com contagem, busca e filtro de status vão ao servidor", async ({ page }) => {
    const store = await open(page)

    await expect(page.getByRole("tab", { name: /Todas\s*3/ })).toHaveAttribute("aria-selected", "true")
    await expect(page.getByRole("tab", { name: /Não lidas\s*1/ })).toBeVisible()
    await expect(page.getByRole("tab", { name: /Favoritas\s*1/ })).toBeVisible()

    await page.getByRole("searchbox", { name: "Buscar conversa" }).fill("bruno")
    await expect.poll(() => store.listRequests.at(-1)?.get("search")).toBe("bruno")
    await expect(list(page).getByRole("button", { name: /Bruno Lima/ })).toBeVisible()
    await expect(list(page).getByRole("button", { name: /Ana Paula/ })).toHaveCount(0)
    await page.getByRole("searchbox", { name: "Buscar conversa" }).fill("")

    await page.getByRole("button", { name: /^Status:/ }).click()
    await page.getByRole("group", { name: "Status" }).getByRole("button", { name: "Pendente" }).click()
    await expect.poll(() => store.listRequests.at(-1)?.getAll("status")).toEqual(["Pendente"])
    await expect(list(page).getByRole("button", { name: /Bruno Lima/ })).toBeVisible()
    await expect(list(page).getByRole("button", { name: /Ana Paula/ })).toHaveCount(0)
    await expect(page).toHaveURL(/conversaStatus=Pendente/)
  })

  test("aba Não lidas e aba Favoritas recortam a lista", async ({ page }) => {
    await open(page)

    await page.getByRole("tab", { name: /Não lidas/ }).click()
    await expect(list(page).getByRole("button", { name: /Ana Paula/ })).toBeVisible()
    await expect(list(page).getByRole("button", { name: /Bruno Lima/ })).toHaveCount(0)

    await page.getByRole("tab", { name: /Favoritas/ }).click()
    await expect(list(page).getByRole("button", { name: /Bruno Lima/ })).toBeVisible()
    await expect(list(page).getByRole("button", { name: /Ana Paula/ })).toHaveCount(0)
  })
})

test.describe("abrir conversa", () => {
  test("marca como lida na hora: o badge some e a contagem de Não lidas cai", async ({ page }) => {
    const store = await open(page)

    await expect(page.getByRole("tab", { name: /Não lidas\s*1/ })).toBeVisible()
    await list(page).getByRole("button", { name: /Ana Paula/ }).click()
    await expect(page.getByRole("button", { name: "Ações de Ana Paula" })).toBeVisible()
    await expect.poll(() => store.readRequests.at(-1)).toMatchObject({ id: "conv-1", method: "POST" })

    await backToListOnMobile(page)
    await expect(page.getByRole("tab", { name: /Não lidas\s*0/ })).toBeVisible()
  })
})

test.describe("menu ⋮", () => {
  async function openThread(page: Page, contact = "Ana Paula") {
    await list(page).getByRole("button", { name: new RegExp(contact) }).click()
    await page.getByRole("button", { name: `Ações de ${contact}` }).click()
  }

  test("marcar como não lida volta o badge e soma a contagem", async ({ page }) => {
    const store = await open(page)
    await openThread(page, "Bruno Lima")
    await page.getByRole("menuitem", { name: "Marcar como não lida" }).click()

    await expect.poll(() => store.readRequests.at(-1)).toMatchObject({ id: "conv-2", method: "DELETE" })
    await backToListOnMobile(page)
    await expect(page.getByRole("tab", { name: /Não lidas\s*2/ })).toBeVisible()
  })

  test("favoritar/desfavoritar chama o servidor e atualiza a estrela", async ({ page }) => {
    const store = await open(page)
    await openThread(page, "Ana Paula")
    await page.getByRole("menuitem", { name: "Favoritar" }).click()

    await expect.poll(() => store.favoriteRequests.at(-1)).toMatchObject({ id: "conv-1", method: "POST" })
    await backToListOnMobile(page)
    await expect(page.getByRole("tab", { name: /Favoritas\s*2/ })).toBeVisible()
  })

  test("trocar status pelo submenu atualiza o cabeçalho da thread e a lista", async ({ page }) => {
    const store = await open(page)
    await openThread(page, "Ana Paula")
    await page.getByRole("menuitem", { name: "Status" }).click()
    await page.getByRole("menuitem", { name: "Resolvida" }).click()

    await expect.poll(() => store.statusRequests.at(-1)).toMatchObject({ id: "conv-1", status: "Resolvida" })
    // Escopado ao selo da thread: o próprio menu, ainda fechando (animação de saída), pode ter por um
    // instante um item de menu com o mesmo texto ("Resolvida", já sem grifo de "atual").
    await expect(page.locator('[data-slot="badge"]').filter({ hasText: "Resolvida" })).toBeVisible()
  })

  test("abrir negócio sai da Inbox para o Pipeline com o negócio certo", async ({ page }) => {
    await open(page)
    await openThread(page, "Ana Paula")
    await page.getByRole("menuitem", { name: "Abrir negócio" }).click()
    // "Abrir negócio" é navegação de verdade (troca de tela), não um overlay por cima da Inbox.
    await expect(page).toHaveURL(/vista=pipeline/)
    await expect(page).toHaveURL(/negocio=deal-1/)
  })

  test("abrir empresa sai da Inbox para a ficha da empresa certa", async ({ page }) => {
    await open(page)
    await openThread(page, "Ana Paula")
    await page.getByRole("menuitem", { name: "Abrir empresa" }).click()
    await expect(page).toHaveURL(/vista=empresas/)
    await expect(page).toHaveURL(/empresa=company-1/)
  })
})

test.describe("tags e automação", () => {
  test("adicionar uma tag existente e criar uma nova", async ({ page }) => {
    const store = await open(page)
    test.skip(isMobile(page), "O painel de contexto só aparece em telas largas (xl+).")
    await list(page).getByRole("button", { name: /Ana Paula/ }).click()

    await page.getByRole("button", { name: "Adicionar tag" }).click()
    await page.getByRole("textbox", { name: "Buscar ou criar tag" }).fill("VIP")
    await page.getByRole("button", { name: "VIP" }).click()
    await expect.poll(() => store.tagApplyRequests.at(-1)).toMatchObject({ id: "conv-1", name: "VIP" })

    await page.getByRole("textbox", { name: "Buscar ou criar tag" }).fill("Prioridade")
    await page.getByRole("button", { name: /Criar\s*.Prioridade./ }).click()
    await expect.poll(() => store.tagApplyRequests.at(-1)).toMatchObject({ id: "conv-1", name: "Prioridade" })
  })

  test("remover uma tag aplicada chama o servidor", async ({ page }) => {
    const store = await open(page)
    test.skip(isMobile(page), "O painel de contexto só aparece em telas largas (xl+).")
    await list(page).getByRole("button", { name: /Bruno Lima/ }).click()

    await page.getByRole("button", { name: "Remover tag VIP" }).click()
    await expect.poll(() => store.tagRemoveRequests.at(-1)).toMatchObject({ id: "conv-2", tagOptionId: "tag-vip" })
  })

  test("o toggle de automação chama o servidor com o valor novo", async ({ page }) => {
    const store = await open(page)
    test.skip(isMobile(page), "O painel de contexto só aparece em telas largas (xl+).")
    await list(page).getByRole("button", { name: /Ana Paula/ }).click()

    const toggle = page.getByRole("switch", { name: "Ativar automação" })
    await toggle.click()
    await expect.poll(() => store.automationRequests.at(-1)).toMatchObject({ id: "conv-1", enabled: true })
    await expect(page.getByRole("switch", { name: "Desativar automação" })).toBeChecked()
  })
})

test.describe("atalhos de teclado", () => {
  test("J/K navegam a lista sem voltar ao início/fim; barra foca a busca", async ({ page }) => {
    await open(page)
    test.skip(isMobile(page), "No celular a busca fica coberta pela thread; ver o teste de Esc.")

    await page.keyboard.press("j")
    await expect(list(page).getByRole("button", { name: /Ana Paula/ })).toHaveAttribute("aria-current", "true")
    await page.keyboard.press("j")
    await expect(list(page).getByRole("button", { name: /Bruno Lima/ })).toHaveAttribute("aria-current", "true")
    await page.keyboard.press("j")
    await expect(list(page).getByRole("button", { name: /Clara Souza/ })).toHaveAttribute("aria-current", "true")
    // Fim da lista: sem wrap, o terceiro "j" não faz nada.
    await page.keyboard.press("j")
    await expect(list(page).getByRole("button", { name: /Clara Souza/ })).toHaveAttribute("aria-current", "true")

    await page.keyboard.press("k")
    await expect(list(page).getByRole("button", { name: /Bruno Lima/ })).toHaveAttribute("aria-current", "true")

    await page.keyboard.press("/")
    await expect(page.getByRole("searchbox", { name: "Buscar conversa" })).toBeFocused()
    // Digitar no campo focado não deve disparar J/K.
    await page.keyboard.type("j")
    await expect(page.getByRole("searchbox", { name: "Buscar conversa" })).toHaveValue("j")
  })

  test("Esc no celular volta da thread para a lista", async ({ page }) => {
    await open(page)
    test.skip(!isMobile(page), "Atalho específico do mestre-detalhe do celular.")

    await list(page).getByRole("button", { name: /Ana Paula/ }).click()
    await expect(page.getByRole("button", { name: "Voltar para conversas" })).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(page.getByRole("searchbox", { name: "Buscar conversa" })).toBeVisible()
  })
})

test.describe("layout", () => {
  test("a página nunca rola na horizontal", async ({ page }) => {
    await open(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test("o popover de Status abre inteiro dentro da janela", async ({ page }) => {
    await open(page)
    await page.getByRole("button", { name: /^Status:/ }).click()
    const popover = page.getByRole("group", { name: "Status" })
    const box = (await popover.boundingBox())!
    const viewport = page.viewportSize()!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
  })

  test("o cabeçalho não colide com o cluster de busca/sino do shell", async ({ page }) => {
    await open(page)
    const width = page.viewportSize()?.width ?? 0
    test.skip(width < 1024, "O cluster flutuante só existe em telas ≥ lg.")

    const header = page.getByRole("button", { name: /^Canal:/ })
    const cluster = page.getByTestId("shell-actions")
    const headerBox = (await header.boundingBox())!
    const clusterBox = (await cluster.boundingBox())!
    const overlapsHorizontally = headerBox.x < clusterBox.x + clusterBox.width && clusterBox.x < headerBox.x + headerBox.width
    const overlapsVertically = headerBox.y < clusterBox.y + clusterBox.height && clusterBox.y < headerBox.y + headerBox.height
    expect(overlapsHorizontally && overlapsVertically).toBe(false)
  })
})
