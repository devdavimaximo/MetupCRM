import { data, expect, gotoDashboard, installApi, problem, test } from "./fixtures/app"

test.describe("cada fonte falha e se recupera sozinha", () => {
  test("panorama fora do ar não derruba a fila de tarefas", async ({ page }) => {
    await installApi(page, { overview: problem("O panorama não respondeu.") })
    await gotoDashboard(page)

    await expect(page.getByRole("alert")).toContainText("O panorama não respondeu.")
    // A fila de tarefas fica ao lado no desktop e acima no celular (item 26); a frase acompanha.
    await expect(page.getByText(/O panorama não carregou\. Suas tarefas continuam disponíveis (ao lado|acima)\./)).toBeVisible()
    // A outra fonte continua de pé, com os números dela.
    await expect(page.getByRole("region", { name: "Próximas Tarefas" }).getByText("Padaria Aurora")).toBeVisible()
  })

  test("o retry do panorama recarrega só o panorama", async ({ page }) => {
    // O erro dura até o teste decidir que parou: em desenvolvimento o React monta duas vezes, e
    // "falhar só a primeira chamada" nunca chegaria a aparecer na tela.
    let failing = true
    await installApi(page, {
      overview: async (route) => {
        if (failing) {
          return route.fulfill({
            status: 500,
            contentType: "application/problem+json",
            body: JSON.stringify({ title: "O panorama não respondeu.", status: 500 }),
          })
        }
        await route.fulfill({ contentType: "application/json", body: JSON.stringify(data.overview()) })
      },
    })
    await gotoDashboard(page)

    await expect(page.getByRole("alert")).toContainText("O panorama não respondeu.")

    failing = false
    await page.getByRole("button", { name: /Tentar de novo/ }).first().click()

    await expect(page.getByText("Receita Gerada")).toBeVisible()
    await expect(page.getByRole("alert")).toHaveCount(0)
  })

  test("tarefas fora do ar não derrubam o panorama, e têm retry próprio", async ({ page }) => {
    let failing = true
    await installApi(page, {
      summary: async (route) => {
        if (failing) {
          return route.fulfill({
            status: 503,
            contentType: "application/problem+json",
            body: JSON.stringify({ title: "Suas tarefas não responderam.", status: 503 }),
          })
        }
        await route.fulfill({ contentType: "application/json", body: JSON.stringify(data.summary()) })
      },
    })
    await gotoDashboard(page)

    const queue = page.getByRole("region", { name: "Próximas Tarefas" })
    await expect(queue.getByRole("alert")).toContainText("Suas tarefas não responderam.")
    // O panorama inteiro continua legível.
    await expect(page.getByText("Receita Gerada")).toBeVisible()

    failing = false
    await queue.getByRole("button", { name: "Tentar de novo" }).click()
    await expect(queue.getByText("Padaria Aurora")).toBeVisible()
    await expect(queue.getByRole("alert")).toHaveCount(0)
  })

  test("falha ao trocar de período mantém os números do período que estava na tela", async ({ page }) => {
    await installApi(page, {
      overview: async (route) => {
        const days = new URL(route.request().url()).searchParams.get("days")
        if (days === "7") {
          return route.fulfill({
            status: 500,
            contentType: "application/problem+json",
            body: JSON.stringify({ title: "O panorama não respondeu.", status: 500 }),
          })
        }
        await route.fulfill({ contentType: "application/json", body: JSON.stringify(data.overview()) })
      },
    })
    await gotoDashboard(page)

    await page.getByRole("button", { name: /Período de análise/ }).click()
    await page.getByRole("button", { name: "Últimos 7 dias" }).click()

    // Diz qual período está sendo mostrado, em vez de apagar a tela.
    await expect(page.getByRole("alert")).toContainText("Mostrando os dados de Últimos 30 dias.")
    await expect(page.getByLabel("Receita Gerada")).toContainText("48.500")
  })

  test("o feed falha sem levar junto o resto da tela", async ({ page }) => {
    await installApi(page, { feed: problem("A atividade não respondeu.") })
    await gotoDashboard(page)

    await page.getByRole("heading", { name: "Atividade Recente" }).locator("..").getByRole("button", { name: "Ver todas" }).click()

    const sheet = page.getByRole("dialog")
    await expect(sheet.getByRole("alert")).toContainText("A atividade não respondeu.")
    await expect(sheet.getByRole("button", { name: "Tentar de novo" })).toBeVisible()
  })

  test("as notificações falham em silêncio no sino, sem alarme na tela", async ({ page }) => {
    await installApi(page, { notifications: problem("As notificações não responderam.") })
    await gotoDashboard(page)

    await expect(page.getByTestId("notification-count")).toHaveCount(0)
    await page.getByRole("button", { name: /^Notificações/ }).click()
    await expect(page.getByRole("alert")).toContainText("As notificações não responderam.")
  })
})
