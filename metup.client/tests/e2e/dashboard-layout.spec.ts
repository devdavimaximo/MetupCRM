import type { Page } from "@playwright/test"

import { expect, gotoDashboard, installApi, test } from "./fixtures/app"

/** Folga de 1px para arredondamento de sub-pixel do navegador. */
const SLACK = 1

async function pageOverflow(page: Page) {
  return page.evaluate(() => ({
    vertical: document.documentElement.scrollHeight - window.innerHeight,
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
  }))
}

/** Os painéis do dashboard, na ordem do DOM, com a caixa que cada um ocupa. */
async function panelBoxes(page: Page) {
  const panels = page.locator("section[aria-label], section[aria-labelledby]")
  const count = await panels.count()
  const boxes: { name: string; box: { x: number; y: number; width: number; height: number } }[] = []
  for (let index = 0; index < count; index++) {
    const panel = panels.nth(index)
    if (!(await panel.isVisible())) continue
    const box = await panel.boundingBox()
    if (box) boxes.push({ name: (await panel.getAttribute("aria-label")) ?? `painel ${index}`, box })
  }
  return boxes
}

function overlaps(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
  return a.x < b.x + b.width - SLACK && b.x < a.x + a.width - SLACK && a.y < b.y + b.height - SLACK && b.y < a.y + a.height - SLACK
}

test.describe("layout", () => {
  test("a página nunca rola na horizontal", async ({ page }) => {
    await installApi(page)
    await gotoDashboard(page)
    await expect(page.getByText("Receita Gerada")).toBeVisible()

    const { horizontal } = await pageOverflow(page)
    expect(horizontal).toBeLessThanOrEqual(SLACK)
  })

  test("acima de 1600px a tela cabe na janela, sem rolagem vertical", async ({ page }, testInfo) => {
    const width = page.viewportSize()?.width ?? 0
    test.skip(width < 1600, "A regra vale para 1600×900 e 1920×1080; abaixo disso a tela pode rolar.")

    await installApi(page)
    await gotoDashboard(page)
    await expect(page.getByText("Receita Gerada")).toBeVisible()
    // O gráfico e o donut assentam a altura depois de medir o container.
    await expect(page.getByRole("region", { name: "Origem dos Negócios" })).toBeVisible()

    const { vertical } = await pageOverflow(page)
    expect(vertical, `${testInfo.project.name}: a tela passou ${vertical}px da janela`).toBeLessThanOrEqual(SLACK)
  })

  test("nenhum painel se sobrepõe a outro", async ({ page }) => {
    await installApi(page)
    await gotoDashboard(page)
    await expect(page.getByText("Receita Gerada")).toBeVisible()

    const panels = await panelBoxes(page)
    expect(panels.length).toBeGreaterThan(3)

    for (let i = 0; i < panels.length; i++) {
      for (let j = i + 1; j < panels.length; j++) {
        // Painéis aninhados (uma seção dentro de outra) não contam como sobreposição.
        const contained =
          panels[i].box.x <= panels[j].box.x && panels[i].box.y <= panels[j].box.y && panels[i].box.height >= panels[j].box.height
        if (contained) continue
        expect(overlaps(panels[i].box, panels[j].box), `"${panels[i].name}" sobrepõe "${panels[j].name}"`).toBe(false)
      }
    }
  })

  test("os rótulos dos KPIs e da legenda não truncam", async ({ page }) => {
    await installApi(page)
    await gotoDashboard(page)

    const labels = page.locator('[aria-label="Receita Gerada"], [aria-label="Taxa de fechamento"], [aria-label="Ticket Médio"]')
    await expect(labels.first()).toBeVisible()

    const truncated = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll<HTMLElement>('ul[aria-label="Origens dos negócios"] span, section[aria-label] dd')]
      return nodes.filter((node) => node.scrollWidth > node.clientWidth + 1 && node.clientWidth > 0).map((node) => node.textContent ?? "")
    })
    expect(truncated, `truncados: ${truncated.join(" | ")}`).toEqual([])
  })

  test("a tabela de destaques em 1366px não piorou", async ({ page }) => {
    const width = page.viewportSize()?.width ?? 0
    test.skip(width !== 1366, "A folga que sobrou é específica de 1366px.")

    await installApi(page)
    await gotoDashboard(page)
    await expect(page.getByRole("table")).toBeVisible()

    const overflow = await page.getByRole("table").evaluate((table) => {
      const holder = table.parentElement
      return holder ? holder.scrollWidth - holder.clientWidth : 0
    })
    // Pendência registrada da P1: sobram ~60px de rolagem horizontal nessa faixa. O item 26/1366px da
    // onda 3B zera isto; até lá, o teto aqui impede que piore.
    expect(overflow).toBeLessThanOrEqual(60)
  })
})
