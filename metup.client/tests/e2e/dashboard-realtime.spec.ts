import { data, expect, gotoDashboard, installApi, test } from "./fixtures/app"

/**
 * O hub SignalR não sobe nesta suíte (ver `fixtures/app.ts`). Sem conexão, o cliente de tempo real
 * pede revalidação quando a aba volta ao foco — e o dashboard trata esse pedido exatamente como
 * trata um evento do hub: espera o debounce, refaz as consultas em segundo plano (sem skeleton) e
 * realça o que chegou. É esse caminho que os testes aqui exercitam.
 */
const NEW_EVENT = {
  id: "ev-novo",
  kind: "DealWon",
  dealId: "deal-9",
  companyName: "Ótica Central",
  actorName: "Ana Prado",
  occurredAt: "2026-09-15T14:20:00Z",
  toStage: null,
  activityType: null,
  outcome: null,
  amount: 7_200,
}

test.describe("atualização em segundo plano", () => {
  test("o evento novo entra na Atividade Recente realçado, sem piscar a tela", async ({ page }) => {
    let fresh = false
    await installApi(page, {
      overview: () =>
        fresh
          ? data.overview({ recentEvents: [NEW_EVENT, ...data.recentEvents], revenue: { current: 55_700, previous: 31_000 } })
          : data.overview(),
    })
    await gotoDashboard(page)

    const recent = page.getByRole("region", { name: "Atividade Recente" })
    await expect(recent.getByText("Padaria Aurora")).toBeVisible()
    await expect(recent.getByText("Ótica Central")).toHaveCount(0)

    fresh = true
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))

    // Chega depois do debounce, sem skeleton no caminho: a tela nunca volta ao estado de carregando.
    await expect(recent.getByText("Ótica Central")).toBeVisible({ timeout: 10_000 })
    await expect(page.locator("[role=status]")).toHaveCount(0)
    await expect(page.locator("[data-highlight=true]")).toHaveCount(1)
    await expect(page.getByLabel("Receita Gerada")).toContainText("55.700")
  })

  test("o realce some sozinho depois de um instante", async ({ page }) => {
    let fresh = false
    await installApi(page, {
      overview: () => (fresh ? data.overview({ recentEvents: [NEW_EVENT, ...data.recentEvents] }) : data.overview()),
    })
    await gotoDashboard(page)
    await expect(page.getByRole("region", { name: "Atividade Recente" }).getByText("Padaria Aurora")).toBeVisible()

    fresh = true
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))

    await expect(page.locator("[data-highlight=true]")).toHaveCount(1, { timeout: 10_000 })
    await expect(page.locator("[data-highlight=true]")).toHaveCount(0, { timeout: 10_000 })
    // O evento continua na lista; só o destaque passou.
    await expect(page.getByText("Ótica Central")).toBeVisible()
  })

  test("falha na atualização em segundo plano não apaga o que está na tela", async ({ page }) => {
    let failing = false
    await installApi(page, {
      overview: (route) =>
        failing
          ? route.fulfill({ status: 500, contentType: "application/problem+json", body: JSON.stringify({ title: "caiu" }) })
          : data.overview(),
    })
    await gotoDashboard(page)
    await expect(page.getByLabel("Receita Gerada")).toContainText("48.500")

    failing = true
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))

    // Silêncio é o comportamento certo: nada de alerta, nada de tela vazia.
    await expect(page.getByLabel("Receita Gerada")).toContainText("48.500")
    await expect(page.getByRole("alert")).toHaveCount(0)
  })

  test("o indicador mostra que o tempo real está fora do ar", async ({ page }) => {
    await installApi(page)
    await gotoDashboard(page)

    const indicator = page.getByTestId("realtime-indicator")
    await expect(indicator).toHaveAttribute("data-status", /connecting|reconnecting|disconnected/)
    await expect(indicator).toContainText("Reconectando…")
  })
})
