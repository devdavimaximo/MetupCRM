import type { Locator, Page } from "@playwright/test"

import { BoardStore, expect, gotoPipeline, installApi, test } from "./fixtures/app"

/** Abaixo de md o quadro é outra árvore: uma coluna por vez, com abas. */
const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 768

const column = (page: Page, stage: string) => page.locator(`section[data-stage="${stage}"]`)
const card = (page: Page, company: string) => page.locator("[data-deal-card]").filter({ hasText: company })
const cardButton = (page: Page, company: string) => card(page, company).locator("button[aria-roledescription]")

/**
 * Arrasto com o mouse: aperta no cartão, passa do limiar de 6px e solta no alvo. O alvo é resolvido
 * **depois** que o arrasto começa (as zonas de Fechados só existem durante o arrasto).
 */
async function dragWithMouse(page: Page, source: Locator, target: () => Locator) {
  await source.scrollIntoViewIfNeeded()
  const from = (await source.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + 16)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + 20, { steps: 4 })
  const to = (await target().boundingBox())!
  await page.mouse.move(to.x + to.width / 2, to.y + Math.min(80, to.height / 2), { steps: 12 })
  await page.mouse.up()
}

async function open(page: Page, store = new BoardStore(), query = "") {
  await installApi(page, store.routes())
  await gotoPipeline(page, query)
  await expect(page.locator("[data-deal-card]").first()).toBeVisible()
  return store
}

test.describe("quadro", () => {
  test("oito colunas com os números do servidor, est. e o cartão da referência", async ({ page }) => {
    const store = await open(page)
    expect(store.boardRequests[0].get("from")).toBe("2026-08-17")
    expect(store.boardRequests[0].get("to")).toBe("2026-09-15")
    expect(store.boardRequests[0].get("sort")).toBe("Stalled")

    if (isMobile(page)) {
      await expect(page.getByRole("tab")).toHaveCount(8)
      await expect(page.getByRole("tab", { name: /Prospect\s*30/ })).toHaveAttribute("aria-selected", "true")
      return
    }

    await expect(page.locator("section[data-stage]")).toHaveCount(8)
    await expect(column(page, "Prospect")).toContainText("30 negócios")
    await expect(column(page, "Qualificacao")).toContainText("2 negócios")
    await expect(column(page, "Qualificacao")).toContainText("est.")
    await expect(column(page, "ContatoRealizado")).toContainText("Solte aqui")

    const tech = card(page, "Tech Solutions")
    await expect(tech).toContainText("R$ 12.000,00")
    await expect(tech).toContainText("est.")
    await expect(tech).toContainText("Parado há 12 d")
    await expect(tech).toContainText("Serviços")
    await expect(tech).toContainText("Davi Maximo")
    await expect(tech).toContainText("Próxima ação atrasada")
    // Sem atividade: o "há" cai para a entrada na etapa (12 dias).
    await expect(tech.locator("time")).toHaveText("há 12d")
    await expect(tech.locator("time")).toHaveAttribute("title", /^Sem atividade\. Na etapa desde/)
    await expect(card(page, "Ótica Lumen")).toContainText("Sem próxima ação")
  })

  test("Fechados mostra ganhos e perdidos do período, com o motivo da perda", async ({ page }) => {
    await open(page)
    if (isMobile(page)) await page.getByRole("tab", { name: /Fechados/ }).click()

    const closed = column(page, "Fechados")
    await expect(closed.getByRole("button", { name: /Ganhos\s*2/ })).toHaveAttribute("aria-pressed", "true")
    await expect(closed).toContainText("Farmácia Central")
    await expect(closed).not.toContainText("Antiga Ganha")
    await closed.getByRole("button", { name: /Perdidos\s*1/ }).click()
    await expect(card(page, "Bistrô Sabor")).toContainText("Preço")
    await expect(page).toHaveURL(/fechados=perdidos/)
  })

  test("carregar mais: 20 por coluna, e 'Ver todos' traz o resto na própria coluna", async ({ page }) => {
    const store = await open(page)
    const prospect = column(page, "Prospect")
    await expect(prospect.locator("[data-deal-card]")).toHaveCount(20)

    await prospect.getByRole("button", { name: "Ver todos (30)" }).click()
    await expect(prospect.locator("[data-deal-card]")).toHaveCount(30)
    await expect(prospect.getByRole("button", { name: /Ver todos/ })).toHaveCount(0)
    expect(store.columnRequests.some((p) => p.get("stage") === "Prospect" && p.get("page") === "2")).toBe(true)
  })

  test("rolagem infinita: chegar ao fim da coluna carrega a próxima página", async ({ page }) => {
    const store = await open(page)
    const list = column(page, "Prospect").locator("[data-column-list]")
    await list.evaluate((el) => el.scrollTo({ top: el.scrollHeight }))
    await expect(column(page, "Prospect").locator("[data-deal-card]")).toHaveCount(30)
    expect(store.columnRequests.at(-1)?.get("page")).toBe("2")
  })

  test("?etapa=Proposta (chegada do dashboard) destaca a coluna", async ({ page }) => {
    await open(page, new BoardStore(), "&etapa=Proposta")
    if (isMobile(page)) {
      await expect(page.getByRole("tab", { name: /Proposta/ })).toHaveAttribute("aria-selected", "true")
      return
    }
    await expect(column(page, "Proposta")).toHaveAttribute("data-highlighted", "true")
    await expect(column(page, "Proposta")).toBeInViewport()
  })

  test("a página nunca rola na horizontal; só o quadro", async ({ page }) => {
    await open(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test.describe("filtros", () => {
  test("busca com debounce, origem e segmento vão ao servidor, contam no badge e limpam", async ({ page }) => {
    const store = await open(page)

    await page.getByRole("searchbox", { name: /Buscar no quadro/ }).fill("tech")
    await expect.poll(() => store.boardRequests.at(-1)?.get("search")).toBe("tech")
    if (isMobile(page)) {
      // Uma coluna por vez: a aba com contagem mostra onde o resultado está.
      await expect(page.getByRole("tab", { name: /Qualificação\s*1/ })).toBeVisible()
    } else {
      await expect(card(page, "Tech Solutions")).toBeVisible()
      await expect(page.locator("[data-deal-card]")).toHaveCount(1)
    }

    await page.getByRole("button", { name: "Origem" }).click()
    await page.getByRole("group", { name: "Origem" }).getByRole("button", { name: "Meta Ads" }).click()
    await expect.poll(() => store.boardRequests.at(-1)?.getAll("sources")).toEqual(["MetaAds"])
    await page.keyboard.press("Escape")

    await page.getByRole("button", { name: "Segmento" }).click()
    await page.getByRole("group", { name: "Segmento" }).getByRole("button", { name: "Saúde" }).click()
    await expect.poll(() => store.boardRequests.at(-1)?.getAll("segments")).toEqual(["Saúde"])
    await page.keyboard.press("Escape")

    await expect(page.getByText("3 filtros ativos")).toBeVisible()
    await expect(page).toHaveURL(/quadroBusca=tech/)
    await expect(page).toHaveURL(/origens=MetaAds/)

    await page.getByRole("button", { name: "Limpar" }).click()
    await expect.poll(() => store.boardRequests.at(-1)?.has("search")).toBe(false)
    await expect(page.getByText(/filtros? ativos?/)).toHaveCount(0)
  })

  test("ordenação vai ao servidor e à URL", async ({ page }) => {
    const store = await open(page)
    await page.getByRole("button", { name: /Ordenar colunas por/ }).click()
    await page.getByRole("menuitem", { name: "Maior valor" }).click()
    await expect.poll(() => store.boardRequests.at(-1)?.get("sort")).toBe("ValueDesc")
    await expect(page).toHaveURL(/ordem=valor/)
  })

  test("link antigo (origem=MetaAds) continua filtrando e vira a chave nova", async ({ page }) => {
    const store = await open(page, new BoardStore(), "&origem=MetaAds")
    expect(store.boardRequests[0].getAll("sources")).toEqual(["MetaAds"])
    await expect(page).toHaveURL(/origens=MetaAds/)
    await expect(page).not.toHaveURL(/origem=/)
  })
})

test.describe("mover de etapa", () => {
  test("⋮ > Mover para… move na hora, com expectedFromStage e ?view=card", async ({ page }) => {
    const store = await open(page)
    if (isMobile(page)) await page.getByRole("tab", { name: /Qualificação/ }).click()

    await page.getByRole("button", { name: "Ações de Ótica Lumen" }).click()
    await page.getByRole("menuitem", { name: "Mover para…" }).click()
    await page.getByRole("menuitem", { name: "Reunião" }).click()

    await expect.poll(() => store.stageRequests.at(-1)).toEqual({ id: "q-2", stage: "Reuniao", expectedFromStage: "Qualificacao", view: "card" })
    await expect(page.getByRole("status").filter({ hasText: "Movido para Reunião." })).toBeVisible()
    if (!isMobile(page)) {
      await expect(column(page, "Reuniao")).toContainText("Ótica Lumen")
      await expect(column(page, "Reuniao")).toContainText("2 negócios")
      await expect(column(page, "Qualificacao")).toContainText("1 negócio")
    }
  })

  test("arrastar com o mouse entre colunas", async ({ page }) => {
    test.skip(isMobile(page), "No celular uma coluna por vez: o arrasto por toque não é dublável aqui; o menu ⋮ cobre o celular.")
    const store = await open(page)

    await dragWithMouse(page, cardButton(page, "Padaria Aurora"), () => column(page, "Prospect"))
    await expect(column(page, "Prospect")).toContainText("Padaria Aurora")
    await expect(column(page, "Prospect")).toContainText("31 negócios")
    await expect(column(page, "PrimeiroContato")).toContainText("1 negócio")
    await expect.poll(() => store.stageRequests.at(-1)).toMatchObject({ id: "pc-1", stage: "Prospect", expectedFromStage: "PrimeiroContato" })
    expect(store.find("pc-1").stage).toBe("Prospect")
  })

  test("soltar na mesma coluna não faz nada e o clique continua abrindo a ficha", async ({ page }) => {
    test.skip(isMobile(page), "Arrasto com mouse só no desktop.")
    const store = await open(page)
    await dragWithMouse(page, cardButton(page, "Padaria Aurora"), () => column(page, "PrimeiroContato"))
    await expect(column(page, "PrimeiroContato")).toContainText("Padaria Aurora")
    expect(store.stageRequests).toHaveLength(0)
  })

  test("teclado: Espaço pega, → troca de coluna, Espaço solta; anúncios em pt-br", async ({ page }) => {
    test.skip(isMobile(page), "No celular não há coluna vizinha na tela; a alternativa é o menu ⋮.")
    const store = await open(page)
    const live = page.locator('[id^="DndLiveRegion"]')

    await cardButton(page, "Ótica Lumen").focus()
    await page.keyboard.press("Space")
    await expect(live).toContainText("Negócio Ótica Lumen pego. Coluna Qualificação, 4 de 8.")
    await page.keyboard.press("ArrowRight")
    await expect(live).toContainText("Coluna Reunião, 5 de 8.")
    await page.keyboard.press("Space")

    await expect(column(page, "Reuniao")).toContainText("Ótica Lumen")
    await expect.poll(() => store.stageRequests.at(-1)).toMatchObject({ id: "q-2", stage: "Reuniao", expectedFromStage: "Qualificacao" })
  })

  test("teclado: Esc cancela e nada muda", async ({ page }) => {
    test.skip(isMobile(page), "No celular a alternativa é o menu ⋮.")
    const store = await open(page)
    await cardButton(page, "Ótica Lumen").focus()
    await page.keyboard.press("Space")
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("Escape")
    await expect(page.locator('[id^="DndLiveRegion"]')).toContainText("Movimento cancelado")
    await expect(column(page, "Qualificacao")).toContainText("Ótica Lumen")
    expect(store.stageRequests).toHaveLength(0)
  })

  test("desfazer é uma nova mudança de etapa, com o expectedFromStage certo", async ({ page }) => {
    const store = await open(page)
    if (isMobile(page)) await page.getByRole("tab", { name: /Qualificação/ }).click()

    await page.getByRole("button", { name: "Ações de Ótica Lumen" }).click()
    await page.getByRole("menuitem", { name: "Mover para…" }).click()
    await page.getByRole("menuitem", { name: "Proposta" }).click()
    await page.getByRole("button", { name: "Desfazer" }).click()

    await expect.poll(() => store.stageRequests.length).toBe(2)
    expect(store.stageRequests[1]).toMatchObject({ id: "q-2", stage: "Qualificacao", expectedFromStage: "Proposta" })
    await expect(page.getByText("Movimento desfeito. Ótica Lumen voltou para Qualificação.")).toBeVisible()
    expect(store.find("q-2").stage).toBe("Qualificacao")
    if (!isMobile(page)) await expect(column(page, "Qualificacao")).toContainText("Ótica Lumen")
  })

  test("409: outro usuário já moveu — o cartão vai para a etapa real e o aviso diz qual", async ({ page }) => {
    const store = await open(page)
    store.movedByOther.set("q-2", "Proposta")
    if (isMobile(page)) await page.getByRole("tab", { name: /Qualificação/ }).click()

    await page.getByRole("button", { name: "Ações de Ótica Lumen" }).click()
    await page.getByRole("menuitem", { name: "Mover para…" }).click()
    await page.getByRole("menuitem", { name: "Reunião" }).click()

    await expect(page.getByRole("alert").filter({ hasText: "Outro usuário já moveu este negócio para Proposta." })).toBeVisible()
    if (!isMobile(page)) {
      await expect(column(page, "Proposta")).toContainText("Ótica Lumen")
      await expect(column(page, "Reuniao")).not.toContainText("Ótica Lumen")
      await expect(column(page, "Qualificacao")).not.toContainText("Ótica Lumen")
    }
  })

  test("erro do servidor devolve o cartão e avisa", async ({ page }) => {
    const store = await open(page)
    store.failNextStage = true
    if (isMobile(page)) await page.getByRole("tab", { name: /Qualificação/ }).click()

    await page.getByRole("button", { name: "Ações de Ótica Lumen" }).click()
    await page.getByRole("menuitem", { name: "Mover para…" }).click()
    await page.getByRole("menuitem", { name: "Reunião" }).click()

    await expect(page.getByRole("alert").filter({ hasText: "O servidor não respondeu." })).toBeVisible()
    await expect(column(page, "Qualificacao")).toContainText("Ótica Lumen")
    await expect(column(page, "Qualificacao")).toContainText("2 negócios")
  })
})

test.describe("soltar em Fechados", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 768, "As zonas de Fechados aparecem durante o arrasto com mouse, só no desktop.")

  async function dropOnClosed(page: Page, company: string, zone: "won" | "lost") {
    await column(page, "Fechados").scrollIntoViewIfNeeded()
    await dragWithMouse(page, cardButton(page, company), () => page.locator(`[data-close-zone="${zone}"]`))
  }

  test("Ganho: diálogo com o valor efetivo; confirmar leva o cartão para Ganhos", async ({ page }) => {
    const store = await open(page)
    await dropOnClosed(page, "Clínica Vida", "won")

    const dialog = page.getByRole("dialog", { name: "Marcar como ganho" })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel("Valor fechado")).toHaveValue("30000,00")
    await dialog.getByRole("button", { name: "Confirmar ganho" }).click()

    await expect(dialog).toBeHidden()
    expect(store.closeRequests.at(-1)).toMatchObject({ id: "n-1", won: true, closedAmount: 30_000, lostReason: null })
    await expect(column(page, "Fechados").getByRole("button", { name: /Ganhos\s*3/ })).toBeVisible()
    await expect(column(page, "Fechados")).toContainText("Clínica Vida")
    await expect(column(page, "Negociacao")).not.toContainText("Clínica Vida")
  })

  test("Perdido: o motivo é obrigatório; com motivo, fecha e mostra o rótulo", async ({ page }) => {
    const store = await open(page)
    await dropOnClosed(page, "Pet Feliz", "lost")

    const dialog = page.getByRole("dialog", { name: "Marcar como perdido" })
    await dialog.getByRole("button", { name: "Confirmar perda" }).click()
    await expect(dialog.getByRole("alert")).toHaveText("Escolha o motivo da perda.")
    expect(store.closeRequests).toHaveLength(0)

    await dialog.getByRole("radio", { name: "Sem resposta" }).click()
    await dialog.getByLabel("Observação (opcional)").fill("Sumiu depois da proposta")
    await dialog.getByRole("button", { name: "Confirmar perda" }).click()

    await expect(dialog).toBeHidden()
    expect(store.closeRequests.at(-1)).toMatchObject({ id: "n-2", won: false, lostReason: "SemResposta", lostNote: "Sumiu depois da proposta" })
    await expect(column(page, "Fechados").getByRole("button", { name: /Perdidos\s*2/ })).toHaveAttribute("aria-pressed", "true")
    await expect(card(page, "Pet Feliz")).toContainText("Sem resposta")
  })

  test("cancelar o diálogo (Esc) devolve o cartão sem chamar o servidor", async ({ page }) => {
    const store = await open(page)
    await dropOnClosed(page, "Clínica Vida", "won")
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.keyboard.press("Escape")

    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(column(page, "Negociacao")).toContainText("Clínica Vida")
    expect(store.closeRequests).toHaveLength(0)
  })

  test("cartão fechado não arrasta: cursor de proibido e dica", async ({ page }) => {
    await open(page)
    const farm = cardButton(page, "Farmácia Central")
    await farm.scrollIntoViewIfNeeded()
    const box = (await farm.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + 16)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 - 40, box.y + 30, { steps: 6 })
    await expect(card(page, "Farmácia Central").getByText("Negócio fechado não volta ao funil.")).toBeVisible()
    await expect(farm).toHaveClass(/cursor-not-allowed/)
    await page.mouse.up()
    await expect(page.locator("[data-close-zone]")).toHaveCount(0)
  })
})

test.describe("novo negócio", () => {
  test("+ Adicionar da coluna abre o drawer já na etapa", async ({ page }) => {
    test.skip(isMobile(page), "No celular a coluna ativa é Prospect; o FAB cobre o CTA.")
    await open(page)
    await page.getByRole("button", { name: "Adicionar negócio em Reunião" }).click()
    const drawer = page.getByRole("dialog")
    await expect(drawer).toContainText("Nasce em Reunião")
    await expect(drawer.getByRole("searchbox", { name: "Buscar empresa" })).toBeFocused()
  })

  test("Novo negócio (CTA ou FAB) pede a empresa primeiro", async ({ page }) => {
    await open(page)
    await page.getByRole("button", { name: "Novo negócio" }).click()
    await expect(page.getByRole("dialog").getByRole("searchbox", { name: "Buscar empresa" })).toBeVisible()
  })
})
