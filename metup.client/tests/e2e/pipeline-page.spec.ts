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

  test("a coluna carrega 20 e 'Ver todos' abre a etapa inteira na lista lateral", async ({ page }) => {
    const store = await open(page)
    const prospect = column(page, "Prospect")
    await expect(prospect.locator("[data-deal-card]")).toHaveCount(20)

    await prospect.getByRole("button", { name: "Ver todos (30)" }).click()

    // A lista é do servidor, paginada, e o quadro continua atrás dela.
    const list = page.getByRole("dialog", { name: "Prospect" })
    await expect(list).toContainText("30 negócios")
    await expect(list.getByRole("row")).toHaveCount(26) // 25 da página + o cabeçalho
    await expect(page).toHaveURL(/lista=Prospect/)
    expect(store.columnRequests.some((p) => p.get("stage") === "Prospect" && p.get("perColumn") === "25")).toBe(true)

    await list.getByRole("button", { name: "Próxima" }).click()
    await expect.poll(() => store.columnRequests.at(-1)?.get("page")).toBe("2")

    await page.keyboard.press("Escape")
    await expect(page).not.toHaveURL(/lista=/)
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
    // O sensor do dnd-kit só assina o teclado no tique seguinte ao Espaço: sem esta folga, a
    // primeira seta se perde.
    await page.waitForTimeout(100)
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
    await expect(page.locator('[id^="DndLiveRegion"]')).toContainText("pego")
    // O sensor do dnd-kit só assina o teclado no tique seguinte ao Espaço: sem esta folga, a
    // primeira seta se perde.
    await page.waitForTimeout(100)
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

test.describe("KPIs e funil", () => {
  test("cinco KPIs com valor compacto, variação e o valor inteiro no title", async ({ page }) => {
    const store = await open(page)
    const kpi = page.getByRole("button", { name: /Pipeline total/ }).first()

    await expect(page.getByText("R$ 2,86 mi")).toBeVisible()
    await expect(page.getByText("R$ 2,86 mi")).toHaveAttribute("title", /2\.860\.000/)
    await expect(page.getByText("Negócios em aberto")).toBeVisible()
    await expect(page.getByText("Taxa de conversão")).toBeVisible()
    await expect(kpi).toBeVisible()

    // O resumo segue os mesmos filtros do quadro.
    expect(store.summaryRequests.length).toBeGreaterThan(0)
  })

  test("o × oculta o cartão e 'Restaurar cards' traz de volta", async ({ page }) => {
    test.skip(isMobile(page), "No celular os KPIs são carrossel; o acabamento é da PL4.")
    await open(page)

    await page.getByRole("button", { name: "Ocultar o indicador Ticket médio" }).click()
    await expect(page.getByText("Ticket médio")).toHaveCount(0)

    await page.getByRole("button", { name: /Restaurar cards/ }).click()
    await expect(page.getByText("Ticket médio")).toBeVisible()
  })

  test("clicar numa etapa do funil leva o quadro até a coluna", async ({ page }) => {
    test.skip(isMobile(page), "No celular a coluna vira aba; o destaque é outro.")
    await open(page)
    const funnel = page.getByTestId("pipeline-funnel")
    await expect(funnel).toContainText("Do total de 342 prospects")

    await funnel.getByRole("button", { name: /^Proposta:/ }).click()
    await expect(column(page, "Proposta")).toBeInViewport()
  })
})

test.describe("menu ⋮ completo", () => {
  /** No celular só uma coluna aparece: a aba da etapa vem antes do menu. */
  async function openMenu(page: Page, company: string, stage = "Qualificação") {
    if (isMobile(page)) await page.getByRole("tab", { name: new RegExp(stage) }).click()
    await card(page, company).getByRole("button", { name: `Ações de ${company}` }).click()
  }

  test("registrar atividade abre o formulário e revalida só o cartão", async ({ page }) => {
    const store = await open(page)
    await openMenu(page, "Ótica Lumen")
    await page.getByRole("menuitem", { name: "Registrar atividade" }).click()

    await expect(page.getByRole("dialog", { name: "Registrar atividade" })).toContainText("Ótica Lumen")
    // O quadro não recarrega por causa do registro: só o cartão é revalidado depois de salvar.
    expect(store.boardRequests.length).toBeLessThanOrEqual(2)
  })

  test("nova tarefa abre a ficha já com o negócio escolhido", async ({ page }) => {
    await open(page)
    await openMenu(page, "Ótica Lumen")
    await page.getByRole("menuitem", { name: "Nova tarefa" }).click()

    await expect(page.getByRole("dialog")).toContainText("Ótica Lumen")
  })

  test("marcar como ganho abre o mesmo diálogo de fechamento", async ({ page }) => {
    await open(page)
    await openMenu(page, "Ótica Lumen")
    await page.getByRole("menuitem", { name: "Marcar como ganho" }).click()

    await expect(page.getByRole("dialog")).toContainText("Valor fechado")
  })

  test("reatribuir troca o responsável no cartão e chama o servidor", async ({ page }) => {
    const store = await open(page)
    await openMenu(page, "Ótica Lumen")
    await page.getByRole("menuitem", { name: "Reatribuir responsável" }).click()
    await page.getByRole("dialog", { name: "Reatribuir responsável" }).getByRole("button", { name: "Ana Prado" }).click()

    await expect(card(page, "Ótica Lumen")).toContainText("Ana Prado")
    await expect.poll(() => store.reassignRequests.at(-1)).toMatchObject({ id: "q-2", ownerUserId: "u-2" })
  })

  test("abrir empresa sai do quadro para a ficha da empresa", async ({ page }) => {
    await open(page)
    await openMenu(page, "Ótica Lumen")
    await page.getByRole("menuitem", { name: "Abrir empresa" }).click()

    await expect(page).toHaveURL(/empresa=/)
  })
})

test.describe("faixa inferior", () => {
  test("insights trazem as três frases e 'Ver lista' filtra por parados", async ({ page }) => {
    const store = await open(page)
    const insights = page.getByRole("region", { name: "Insights do Pipeline" })

    await expect(insights).toContainText("Qualificação recebeu 18 negócios")
    await expect(insights).toContainText("De Qualificação para Reunião, 80% avançam")
    await expect(insights).toContainText("3 negócios parados há mais de 7 dias")

    await insights.getByRole("button", { name: "Ver lista" }).click()
    await expect(page).toHaveURL(/parados=1/)
    await expect.poll(() => store.boardRequests.at(-1)?.get("stalledOnly")).toBe("true")
    await expect(page.getByText("Só negócios parados")).toBeVisible()
  })

  test("'Ver detalhes' do maior volume leva à coluna da etapa", async ({ page }) => {
    test.skip(isMobile(page), "No celular a coluna vira aba.")
    await open(page)
    await page.getByRole("region", { name: "Insights do Pipeline" }).getByRole("button", { name: "Ver detalhes" }).first().click()
    await expect(column(page, "Qualificacao")).toBeInViewport()
  })

  test("o seletor de meses da evolução vai ao servidor e à URL", async ({ page }) => {
    const store = await open(page)
    const evolution = page.getByRole("region", { name: "Evolução do Pipeline" })
    await expect.poll(() => store.evolutionRequests.at(-1)).toBe(6)

    await evolution.getByRole("radio", { name: "Últimos 12 meses" }).click()
    await expect.poll(() => store.evolutionRequests.at(-1)).toBe(12)
    await expect(page).toHaveURL(/evolucao=12/)
  })

  test("atividades recentes mostram 5 eventos e 'Ver todas' abre o feed", async ({ page }) => {
    await open(page)
    const activities = page.getByRole("region", { name: "Atividades Recentes" })
    await expect(activities.getByRole("listitem")).toHaveCount(5)

    await activities.getByRole("button", { name: "Ver todas" }).click()
    await expect(page.getByRole("dialog", { name: /Atividade/i })).toBeVisible()
  })
})
