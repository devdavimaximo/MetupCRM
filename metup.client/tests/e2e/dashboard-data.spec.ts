import { data, expect, gotoDashboard, installApi, test } from "./fixtures/app"

test.describe("recortes de dados que quebram conta", () => {
  test("organização sem histórico anterior não inventa comparação", async ({ page }) => {
    await installApi(page, {
      overview: data.overview({
        // O primeiro negócio nasceu dentro do período: não existe janela anterior para comparar.
        historyStart: "2026-09-01T03:00:00Z",
        revenue: { current: 12_000, previous: 0 },
        wonDeals: { current: 2, previous: 0 },
        lostDeals: { current: 0, previous: 0 },
      }),
    })
    await gotoDashboard(page)

    const revenue = page.getByLabel("Receita Gerada")
    await expect(revenue).toContainText("12.000")
    await expect(revenue).not.toContainText("%")
    await expect(revenue).not.toContainText("vs. período anterior")
  })

  test("negócio só com ticket entra no valor do pipeline, marcado como estimado", async ({ page }) => {
    await installApi(page, {
      overview: data.overview({
        openDealsWithoutAmount: 0,
        pipeline: [
          { stage: "Proposta", count: 4, amount: 40_000, estimatedCount: 4, stalledCount: 0 },
          { stage: "Negociacao", count: 1, amount: 15_000, estimatedCount: 1, stalledCount: 0 },
        ],
      }),
    })
    await gotoDashboard(page)

    // O valor aparece (não zera por falta de "valor em negociação")…
    const stage = page.getByRole("button", { name: /^Proposta: 4 negócios, R\$ 40\.000/ })
    await expect(stage).toBeVisible()

    // …e o tooltip diz de onde ele veio.
    await stage.focus()
    await expect(page.getByRole("tooltip")).toContainText(/estimad/i)
  })

  test("dashboard vazio fala com o usuário em vez de mostrar zeros mudos", async ({ page }) => {
    await installApi(page, {
      overview: data.overview({
        historyStart: null,
        revenue: { current: 0, previous: 0 },
        wonDeals: { current: 0, previous: 0 },
        lostDeals: { current: 0, previous: 0 },
        newDeals: { current: 0, previous: 0 },
        revenueSeries: [],
        pipeline: [],
        stageAdvanceRates: [],
        weightedForecast: null,
        featuredDeals: [],
        recentEvents: [],
        sources: [],
        owners: [],
        openDealsWithoutAmount: 0,
        expectedClose: {
          windowStartLocal: data.TODAY,
          windowEndLocal: "2026-10-14",
          expectedToCloseAmount: 0,
          expectedToCloseCount: 0,
          overdueExpectedCount: 0,
          openDealsWithExpectedCloseDate: 0,
        },
      }),
      summary: data.summary({ taskCounts: { overdue: 0, today: 0, upcoming: 0 }, nextTasks: [] }),
    })
    await gotoDashboard(page)

    await expect(page.getByText("Nenhum negócio ganho neste período.")).toBeVisible()
    await expect(page.getByText("Nenhum negócio novo.")).toBeVisible()
    await expect(page.getByText("Nenhuma tarefa pendente. Bom momento para prospectar.")).toBeVisible()
    await expect(page.getByText("Ligações, mudanças de etapa e fechamentos aparecem aqui.")).toBeVisible()
    // Taxa de fechamento sem nada fechado é "—", não 0%.
    await expect(page.getByLabel("Taxa de fechamento")).toContainText("—")
  })

  test("o SDR vê a própria carteira e não pode alternar o escopo", async ({ page }) => {
    await installApi(page, { overview: data.overview({ scope: "Mine" }) })
    await page.addInitScript(() => {
      const raw = window.localStorage.getItem("metup.session")
      if (!raw) return
      const session = JSON.parse(raw)
      session.user.permissions = session.user.permissions.filter((p: string) => p !== "TeamWideAccess")
      window.localStorage.setItem("metup.session", JSON.stringify(session))
    })
    await gotoDashboard(page)

    await expect(page.getByText("Sua carteira")).toBeVisible()
    await expect(page.getByRole("group", { name: "Escopo dos números" })).toHaveCount(0)
  })

  test("Admin alterna entre a organização e a própria carteira, e o link guarda a escolha", async ({ page }) => {
    const scopes: string[] = []
    await installApi(page, {
      overview: (route) => {
        const scope = new URL(route.request().url()).searchParams.get("scope") ?? ""
        scopes.push(scope)
        return data.overview({ scope: scope === "Mine" ? "Mine" : "Organization" })
      },
    })
    await gotoDashboard(page)

    await page.getByRole("group", { name: "Escopo dos números" }).getByRole("button", { name: "Sua carteira" }).click()

    await expect.poll(() => scopes.at(-1)).toBe("Mine")
    await expect(page).toHaveURL(/escopo=minha/)
  })
})
