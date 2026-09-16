import { expect, gotoDashboard, installApi, test } from "./fixtures/app"

/**
 * O dashboard no celular (item 26). Só faz sentido na largura de celular: nos projetos de desktop a
 * árvore é outra, e as asserções de ordem não valem.
 */
test.describe("mobile", () => {
  test.beforeEach(({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, "A montagem por ação vale abaixo de md (768px).")
    return installApi(page)
  })

  test("a primeira tela mostra saudação, período e as próximas tarefas", async ({ page }) => {
    await gotoDashboard(page)

    const height = page.viewportSize()?.height ?? 0
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByRole("button", { name: /^Período de análise:/ })).toBeVisible()

    const tasks = page.getByRole("region", { name: "Próximas Tarefas" })
    await expect(tasks).toBeVisible()

    // O título das tarefas tem que estar dentro da janela, sem rolar.
    const heading = await page.getByRole("heading", { name: "Próximas Tarefas" }).boundingBox()
    expect(heading, "o painel de tarefas não foi encontrado").not.toBeNull()
    expect(heading!.y + heading!.height, `"Próximas Tarefas" começa a ${heading!.y}px, fora da primeira tela`).toBeLessThan(height)
  })

  test("a ordem do DOM é a ordem de ação, e o cartão Metup não entra", async ({ page }) => {
    await gotoDashboard(page)
    await expect(page.getByRole("region", { name: "Origem dos Negócios" })).toBeVisible()

    const names = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("section[aria-label], section[aria-labelledby]")]
        .filter((node) => node.offsetParent !== null)
        .map((node) => {
          const labelledBy = node.getAttribute("aria-labelledby")
          const label = labelledBy ? document.getElementById(labelledBy)?.textContent : node.getAttribute("aria-label")
          return (label ?? "").trim()
        })
    )

    expect(names).toEqual([
      "Próximas Tarefas",
      "Receita Gerada",
      "Negócios Fechados",
      "Taxa de fechamento",
      "Ticket Médio",
      "Pipeline Comercial",
      "Evolução da Receita",
      "Negócios em Destaque",
      "Atividade Recente",
      "Origem dos Negócios",
    ])
  })

  for (const size of [
    { width: 390, height: 844 },
    { width: 360, height: 740 },
  ]) {
    test(`a página não rola na horizontal em ${size.width}×${size.height}`, async ({ page }) => {
      await page.setViewportSize(size)
      await gotoDashboard(page)
      await expect(page.getByRole("region", { name: "Origem dos Negócios" })).toBeVisible()

      const horizontal = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(horizontal, `a página passou ${horizontal}px da largura`).toBeLessThanOrEqual(1)
    })
  }

  test("nenhuma tabela rola na horizontal: os destaques viram cards", async ({ page }) => {
    await gotoDashboard(page)
    await expect(page.getByRole("region", { name: "Negócios em Destaque" })).toBeVisible()

    await expect(page.getByRole("table")).toHaveCount(0)
    // O nome da empresa do primeiro destaque continua abrindo o negócio.
    const featured = page.getByRole("region", { name: "Negócios em Destaque" })
    await expect(featured.getByRole("listitem").first()).toBeVisible()
  })

  test("os KPIs rolam no carrossel, e a rolagem é do trilho e não da página", async ({ page }) => {
    await gotoDashboard(page)

    const track = page.getByRole("list", { name: "Indicadores do período" })
    await expect(track).toBeVisible()

    const overflow = await track.evaluate((node) => node.scrollWidth - node.clientWidth)
    expect(overflow, "o trilho dos KPIs deveria ter o que rolar").toBeGreaterThan(0)

    await track.evaluate((node) => node.scrollTo({ left: node.clientWidth }))
    await expect.poll(() => track.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0)

    // O quarto KPI só é alcançável depois de rolar o trilho.
    await expect(page.getByRole("region", { name: "Ticket Médio" })).toBeInViewport()
  })

  test("uma etapa do funil compacto abre o Pipeline naquela coluna", async ({ page }) => {
    await gotoDashboard(page)

    await page.getByRole("button", { name: /^Qualificação: .*Abrir no Pipeline$/ }).click()
    await expect(page.getByRole("heading", { level: 1, name: "Pipeline" })).toBeVisible()
    expect(new URL(page.url()).searchParams.get("etapa")).toBe("Qualificacao")
  })

  test("o tooltip do nó Ganhos abre por toque", async ({ page }) => {
    await gotoDashboard(page)

    const won = page.getByRole("region", { name: "Pipeline Comercial" }).locator('li:has-text("Ganhos") [tabindex="0"]').first()
    await won.tap()
    await expect(page.getByRole("tooltip")).toContainText("não fazem parte do pipeline aberto")
  })

  test("o tooltip do donut abre por toque na legenda", async ({ page }) => {
    await gotoDashboard(page)

    const legend = page.getByRole("list", { name: "Origens dos negócios" }).getByRole("button").first()
    await legend.tap()
    await expect(page.getByRole("tooltip")).toContainText("Taxa de ganho")
  })

  test("os alvos de toque das tarefas e do funil têm pelo menos 44px", async ({ page }) => {
    await gotoDashboard(page)

    const stage = page.getByRole("button", { name: /Abrir no Pipeline$/ }).first()
    const box = await stage.boundingBox()
    expect(box!.height, "a linha da etapa ficou abaixo do alvo de toque").toBeGreaterThanOrEqual(44)
  })
})
