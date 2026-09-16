import { data, expect, gotoDashboard, installApi, test } from "./fixtures/app"

test.describe("o que parece clicável funciona", () => {
  test("o menu ⋯ do destaque abre o negócio e a empresa, pelo ponteiro", async ({ page }) => {
    await installApi(page)
    await gotoDashboard(page)

    await page.getByRole("button", { name: "Ações do negócio de Padaria Aurora" }).click()
    await page.getByRole("menuitem", { name: /empresa/i }).click()

    await expect(page).toHaveURL(/vista=empresas/)
    await expect(page).toHaveURL(/empresa=company-1/)
  })

  test("o mesmo menu abre e escolhe pelo teclado", async ({ page }) => {
    await installApi(page)
    await gotoDashboard(page)

    const menu = page.getByRole("button", { name: "Ações do negócio de Padaria Aurora" })
    await menu.focus()
    await page.keyboard.press("Enter")

    const item = page.getByRole("menuitem", { name: /negócio/i })
    await expect(item).toBeVisible()
    await page.keyboard.press("Enter")

    await expect(page).toHaveURL(/negocio=deal-1/)
  })

  test("Esc fecha o menu e devolve o foco ao ⋯", async ({ page }) => {
    await installApi(page)
    await gotoDashboard(page)

    const menu = page.getByRole("button", { name: "Ações do negócio de Padaria Aurora" })
    await menu.click()
    await expect(page.getByRole("menu")).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(page.getByRole("menu")).toBeHidden()
    await expect(menu).toBeFocused()
  })

  test("a etapa do pipeline abre o Pipeline já naquela etapa", async ({ page }) => {
    await installApi(page)
    await gotoDashboard(page)

    await page.getByRole("button", { name: /^Proposta: .*Abrir no Pipeline$/ }).click()

    await expect(page).toHaveURL(/vista=pipeline/)
    await expect(page).toHaveURL(/etapa=Proposta/)
  })

  test("o nó Ganhos explica que é resultado do período, não fotografia do funil", async ({ page }) => {
    // Vale em todas as larguras: no celular o funil vira lista, mas o nó Ganhos continua focável e
    // com o mesmo tooltip (item 26 — o toque está coberto em `dashboard-mobile.spec.ts`).
    await installApi(page)
    await gotoDashboard(page)

    // O nó Ganhos não é botão (não abre nada): entra no Tab só para o tooltip alcançar o teclado.
    await page.locator('li:has-text("Ganhos") [tabindex="0"]').first().focus()
    const hint = page.getByRole("tooltip")
    await expect(hint).toBeVisible()
    await expect(hint).toContainText(/30 dias/)
  })

  test("a legenda do donut mostra os detalhes da origem pelo teclado", async ({ page }) => {
    await installApi(page)
    await gotoDashboard(page)

    await page.getByRole("button", { name: /^SDR: .* dos negócios do período$/ }).focus()

    const hint = page.getByRole("tooltip")
    await expect(hint).toContainText("Negócios no período")
    await expect(hint).toContainText("Taxa de ganho")
  })

  test("concluir uma tarefa tira a linha e pede a fila nova ao servidor", async ({ page }) => {
    let summaryCalls = 0
    await installApi(page, {
      summary: () => {
        summaryCalls += 1
        // A partir da segunda leitura, a tarefa concluída saiu e outra entrou no lugar.
        return summaryCalls <= 2
          ? data.summary()
          : data.summary({
              taskCounts: { overdue: 2, today: 5, upcoming: 9 },
              nextTasks: [
                data.task({ id: "task-2", dealId: "deal-2", companyName: "Mercado Bonfim", type: "WhatsApp" }),
                data.task({ id: "task-3", dealId: "deal-3", companyName: "Clínica Vitória", type: "Meeting" }),
                data.task({ id: "task-4", dealId: "deal-4", companyName: "Auto Center Ipê", type: "Call" }),
              ],
            })
      },
    })
    await gotoDashboard(page)

    const queue = page.getByRole("region", { name: "Próximas Tarefas" })
    await expect(queue.getByRole("checkbox")).toHaveCount(3)

    await queue.getByRole("checkbox", { name: /Padaria Aurora/ }).click()

    // A fila é reposta pelo servidor: a concluída sai e a nova entra, sem conta local.
    await expect(queue.getByText("Auto Center Ipê")).toBeVisible()
    await expect(queue.getByText("Padaria Aurora")).toHaveCount(0)
    await expect(queue.getByRole("checkbox")).toHaveCount(3)
  })

  test("o feed 'Ver todas' pagina por cursor e termina quando acaba", async ({ page }) => {
    await installApi(page)
    await gotoDashboard(page)

    await page.getByRole("heading", { name: "Atividade Recente" }).locator("..").getByRole("button", { name: "Ver todas" }).click()

    const sheet = page.getByRole("dialog")
    await expect(sheet.getByRole("heading", { name: "Atividade" })).toBeVisible()
    await expect(page).toHaveURL(/feed=1/)

    const items = sheet.getByRole("listitem")
    const scroll = sheet.getByTestId("activity-feed-scroll")
    await expect(items).toHaveCount(20)
    await expect(sheet.getByRole("button", { name: "Carregar mais" })).toBeVisible()

    // Rolar até o fim pede a próxima página — o mesmo caminho do "Carregar mais", sem disputar o
    // clique com o carregamento automático que o sentinela dispara ao chegar perto do fim.
    await scroll.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
    await expect(items).toHaveCount(40)

    await scroll.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
    await expect(items).toHaveCount(60)
    await expect(sheet.getByText("Fim da atividade.")).toBeVisible()
    await expect(sheet.getByRole("button", { name: "Carregar mais" })).toHaveCount(0)
  })

  test("o feed filtra por tipo e recomeça a lista no filtro novo", async ({ page }) => {
    const feedCalls: string[] = []
    await installApi(page, {
      feed: (route) => {
        feedCalls.push(new URL(route.request().url()).searchParams.get("kinds") ?? "")
        return data.feedPage(0, false)
      },
    })
    await gotoDashboard(page)

    await page.getByRole("heading", { name: "Atividade Recente" }).locator("..").getByRole("button", { name: "Ver todas" }).click()
    const sheet = page.getByRole("dialog")
    await expect(sheet.getByRole("listitem")).toHaveCount(20)

    await sheet.getByRole("button", { name: "Ganho" }).click()
    await expect.poll(() => feedCalls.at(-1)).toBe("DealWon")
    await expect(sheet.getByRole("listitem")).toHaveCount(20)
  })

  test("Ctrl+K abre a busca global e leva ao resultado", async ({ page }) => {
    await installApi(page)
    await gotoDashboard(page)

    await page.keyboard.press("Control+k")
    const palette = page.getByRole("dialog", { name: "Buscar no CRM" })
    await expect(palette).toBeVisible()

    await page.keyboard.type("aurora")
    await page.getByRole("option", { name: /Padaria Aurora/ }).first().click()

    await expect(page).toHaveURL(/empresa=company-1|negocio=deal-1/)
  })

  test("o sino mostra as notificações e some com o contador ao abrir", async ({ page }) => {
    await installApi(page)
    await gotoDashboard(page)

    const bell = page.getByRole("button", { name: /^Notificações/ })
    await expect(page.getByTestId("notification-count")).toHaveText("2")

    await bell.click()
    await expect(page.getByText(/Padaria Aurora/).first()).toBeVisible()
    await expect(page.getByText("mais de 14 dias sem mudar de etapa")).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(page.getByTestId("notification-count")).toHaveCount(0)
  })
})
