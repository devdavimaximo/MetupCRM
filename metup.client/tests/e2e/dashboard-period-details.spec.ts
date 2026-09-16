import { data, expect, gotoDashboard, installApi, test } from "./fixtures/app"

const openDetails = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: /^Detalhes do período/ }).click()

test.describe("detalhes do período", () => {
  test("mostra o que o painel calcula e não cabe nos KPIs", async ({ page }) => {
    await installApi(page)
    await gotoDashboard(page)

    await openDetails(page)
    const details = page.getByLabel("Detalhes do período: Últimos 30 dias")

    await expect(details.getByText("Novos negócios")).toBeVisible()
    await expect(details.getByText("213")).toBeVisible() // ligações
    await expect(details.getByText("14")).toBeVisible() // reuniões
    await expect(details.getByText("11")).toBeVisible() // propostas
    await expect(details.getByText(/entidade própria/)).toBeVisible()
  })

  test("o bloco de responsáveis traz ganhos, receita e pipeline aberto", async ({ page }) => {
    await installApi(page)
    await gotoDashboard(page)

    await openDetails(page)
    const owners = page.getByRole("table")

    await expect(owners.getByRole("rowheader", { name: "Davi Maximo" })).toBeVisible()
    await expect(owners.getByRole("rowheader", { name: "Ana Prado" })).toBeVisible()
    await expect(owners.getByText("R$ 28.500")).toBeVisible()
  })

  test("na própria carteira, uma lista com só o próprio nome não aparece", async ({ page }) => {
    await installApi(page, {
      overview: data.overview({
        scope: "Mine",
        owners: [{ ownerUserId: "u-1", ownerUserName: "Davi Maximo", wonDeals: 3, revenue: 28_500, openDeals: 24, openAmount: 320_000 }],
      }),
    })
    await gotoDashboard(page, "?escopo=minha")

    await openDetails(page)
    await expect(page.getByText("Atividade no período")).toBeVisible()
    await expect(page.getByText("Responsáveis")).toHaveCount(0)
  })

  test("sem base de comparação, as linhas dizem isso em vez de um percentual inventado", async ({ page }) => {
    await installApi(page, {
      overview: data.overview({
        historyStart: "2026-09-01T03:00:00Z",
        newDeals: { current: 4, previous: 0 },
        callsMade: { current: 9, previous: 0 },
      }),
    })
    await gotoDashboard(page)

    await openDetails(page)
    await expect(page.getByText("sem base anterior").first()).toBeVisible()
  })

  test("abre, navega e fecha pelo teclado, devolvendo o foco ao gatilho", async ({ page }) => {
    await installApi(page)
    await gotoDashboard(page)

    const trigger = page.getByRole("button", { name: /^Detalhes do período/ })
    await trigger.focus()
    await page.keyboard.press("Enter")
    await expect(page.getByText("Atividade no período")).toBeVisible()

    // Cada rótulo é focável para o tooltip da fórmula alcançar o teclado.
    await page.getByText("Novos negócios").focus()
    await expect(page.getByRole("tooltip", { name: /por data de criação/ })).toBeVisible()

    // Esc fecha uma camada por vez: primeiro o tooltip da fórmula, depois o próprio popover.
    await page.keyboard.press("Escape")
    await expect(page.getByRole("tooltip", { name: /por data de criação/ })).toHaveCount(0)
    await expect(page.getByText("Atividade no período")).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(page.getByText("Atividade no período")).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test("nada de cartão novo na grade: a tela continua sem rolagem vertical", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1600, "A regra vale para 1600×900 e 1920×1080.")
    await installApi(page)
    await gotoDashboard(page)
    await expect(page.getByText("Receita Gerada")).toBeVisible()

    const vertical = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
    expect(vertical).toBeLessThanOrEqual(1)
  })
})
