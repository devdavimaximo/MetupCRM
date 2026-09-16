import type { Page } from "@playwright/test"

import { data, expect, gotoDashboard, installApi, test } from "./fixtures/app"

/** O que cada chamada do overview pediu — é o contrato que o seletor de período tem que cumprir. */
function captureOverviewQuery(page: Page) {
  const queries: URLSearchParams[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.pathname === "/api/dashboard/overview") queries.push(url.searchParams)
  })
  return queries
}

const trigger = (page: Page) => page.getByRole("button", { name: /Período de análise/ })

test.describe("período", () => {
  test("começa em 30 dias e o atalho troca a janela pedida ao servidor", async ({ page }) => {
    await installApi(page)
    const queries = captureOverviewQuery(page)
    await gotoDashboard(page)

    await expect(page.getByRole("button", { name: "Período de análise: Últimos 30 dias" })).toBeVisible()
    expect(queries[0].get("days")).toBe("30")

    await trigger(page).click()
    await page.getByRole("button", { name: "Últimos 7 dias" }).click()

    await expect(page.getByRole("button", { name: "Período de análise: Últimos 7 dias" })).toBeVisible()
    await expect.poll(() => queries.at(-1)?.get("days")).toBe("7")
    // O atalho fica na URL, para o link levar o mesmo recorte.
    await expect(page).toHaveURL(/periodo=7d/)
  })

  test("mês anterior pede o mês inteiro por data, não uma janela de 30 dias", async ({ page }) => {
    // Sem trocar `periodEndLocal`: é dele que o front tira o "hoje" da organização, e é a partir
    // desse "hoje" que "mês anterior" resolve para agosto.
    await installApi(page)
    const queries = captureOverviewQuery(page)
    await gotoDashboard(page)

    await trigger(page).click()
    // Escopo nos atalhos: o calendário também tem um botão "Mês anterior" (navegação).
    await page.getByRole("list", { name: "Atalhos" }).getByRole("button", { name: "Mês anterior" }).click()

    await expect.poll(() => queries.at(-1)?.get("from")).toBe("2026-08-01")
    expect(queries.at(-1)?.get("to")).toBe("2026-08-31")
    expect(queries.at(-1)?.get("days")).toBeNull()
  })

  test("intervalo manual: dois cliques no calendário aplicam e fecham", async ({ page }) => {
    await installApi(page)
    const queries = captureOverviewQuery(page)
    await gotoDashboard(page)

    await trigger(page).click()
    await expect(page.getByText("Escolha a data inicial e a final.")).toBeVisible()

    await page.locator('[data-date="2026-09-01"]').click()
    await expect(page.getByText("Agora escolha a data final.")).toBeVisible()
    await page.locator('[data-date="2026-09-10"]').click()

    await expect(page.getByLabel("Escolher período")).toBeHidden()
    await expect.poll(() => queries.at(-1)?.get("from")).toBe("2026-09-01")
    expect(queries.at(-1)?.get("to")).toBe("2026-09-10")
    await expect(page).toHaveURL(/de=2026-09-01/)
    await expect(page).toHaveURL(/ate=2026-09-10/)
  })

  test("o calendário anda pelo teclado e seleciona com Enter", async ({ page }) => {
    await installApi(page)
    const queries = captureOverviewQuery(page)
    await gotoDashboard(page)

    await trigger(page).click()
    await page.locator('[data-date="2026-09-10"]').focus()
    await page.keyboard.press("Enter")
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("Enter")

    await expect.poll(() => queries.at(-1)?.get("from")).toBe("2026-09-10")
    expect(queries.at(-1)?.get("to")).toBe("2026-09-11")
  })

  test("Esc fecha o calendário e devolve o foco ao gatilho", async ({ page }) => {
    await installApi(page)
    await gotoDashboard(page)

    await trigger(page).click()
    await expect(page.getByLabel("Escolher período")).toBeVisible()
    await page.keyboard.press("Escape")

    await expect(page.getByLabel("Escolher período")).toBeHidden()
    // Espera o estado do foco, nunca um `waitForTimeout`: o Radix devolve o foco depois da animação.
    await expect(trigger(page)).toBeFocused()
  })

  test("um link com período abre direto nele", async ({ page }) => {
    await installApi(page, {
      overview: data.overview({ periodStartLocal: "2026-03-01", periodEndLocal: "2026-03-31" }),
    })
    const queries = captureOverviewQuery(page)
    await gotoDashboard(page, "?de=2026-03-01&ate=2026-03-31")

    await expect.poll(() => queries[0]?.get("from")).toBe("2026-03-01")
    await expect(page.getByRole("button", { name: /Período de análise: 1 mar – 31 mar 2026/ })).toBeVisible()
  })

  test("trocar de período mantém os números antigos na tela até a resposta nova chegar", async ({ page }) => {
    await installApi(page, {
      // A resposta é escolhida pela janela pedida, não pela ordem das chamadas — em desenvolvimento o
      // React monta duas vezes e um contador mentiria. A janela nova demora: é nela que o estado
      // "carregando com o dado antigo na tela" aparece.
      overview: async (route) => {
        const isNewWindow = new URL(route.request().url()).searchParams.get("days") === "7"
        if (isNewWindow) await new Promise((resolve) => setTimeout(resolve, 1_500))
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(isNewWindow ? data.overview({ revenue: { current: 1_000, previous: 900 } }) : data.overview()),
        })
      },
    })
    await gotoDashboard(page)

    const revenue = page.getByLabel("Receita Gerada")
    await expect(revenue).toContainText("48.500")

    await trigger(page).click()
    await page.getByRole("button", { name: "Últimos 7 dias" }).click()

    // Enquanto a nova não chega: número antigo ainda legível e a região marcada como ocupada.
    await expect(page.locator("[aria-busy=true]")).toBeVisible()
    await expect(revenue).toContainText("48.500")

    await expect(revenue).toContainText("1.000")
    await expect(page.locator("[aria-busy=true]")).toBeHidden()
  })
})
