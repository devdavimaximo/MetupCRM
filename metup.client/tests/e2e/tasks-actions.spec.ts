import type { Page } from "@playwright/test"

import { data, expect, gotoTasks, installApi, TaskStore, test } from "./fixtures/app"

/** As linhas da lista, na tabela ou nos cards. */
function rows(page: Page) {
  return page.getByRole("tabpanel").locator("[data-task-id]")
}

async function openTasks(page: Page, store = new TaskStore(), query = "", role: "Admin" | "Sdr" = "Admin") {
  await installApi(page, store.routes())
  if (role !== "Admin") {
    // Registrado depois do da `installApi`: a sessão do SDR sobrescreve a do Admin.
    await page.addInitScript((session) => window.localStorage.setItem("metup.session", JSON.stringify(session)), {
      ...data.session,
      user: { ...data.session.user, role },
    })
  }
  await gotoTasks(page, query)
  await expect(rows(page).first()).toBeVisible()
  return store
}

async function openMenu(page: Page, taskId: string) {
  await rows(page).and(page.locator(`[data-task-id="${taskId}"]`)).getByRole("button", { name: /^Mais ações/ }).click()
}

test.describe("menu ⋯ completo", () => {
  test("mostra as ações na ordem da referência", async ({ page }) => {
    await openTasks(page, undefined, "&aba=atrasadas")
    await openMenu(page, "task-1")
    await expect(page.getByRole("menuitem")).toHaveText([
      "Concluir",
      "Reagendar",
      "Registrar atividade",
      "Reatribuir",
      "Abrir negócio",
      "Cancelar tarefa",
    ])
  })

  test("registrar atividade a partir da tarefa conclui a tarefa numa chamada só", async ({ page }) => {
    const store = await openTasks(page, undefined, "&aba=atrasadas")
    await expect(rows(page)).toHaveCount(3)

    await openMenu(page, "task-1")
    await page.getByRole("menuitem", { name: "Registrar atividade" }).click()

    const sheet = page.getByRole("dialog", { name: "Registrar atividade" })
    await expect(sheet).toContainText("Ao salvar, a tarefa é concluída.")
    // task-1 é uma ligação: o tipo já vem marcado.
    await expect(sheet.getByRole("radio", { name: "Ligação" })).toHaveAttribute("aria-checked", "true")
    await sheet.getByRole("radio", { name: "Atendeu", exact: true }).click()
    await sheet.getByRole("button", { name: "Registrar atividade" }).click()

    await expect(sheet).toBeHidden()
    expect(store.loggedActivities).toEqual([{ dealId: "deal-1", type: "Call", completesTaskId: "task-1" }])
    await expect(rows(page)).toHaveCount(2)
    await expect(page.getByText("Atividade registrada e tarefa concluída", { exact: false })).toBeAttached()
  })

  test("reatribuir escolhe o novo responsável no ⋯", async ({ page }) => {
    const store = await openTasks(page, undefined, "&responsavel=todos&aba=atrasadas")
    await openMenu(page, "task-1")
    await page.getByRole("menuitem", { name: "Reatribuir" }).click()

    const panel = page.getByRole("dialog", { name: /^Reatribuir/ })
    await panel.getByRole("option", { name: "Ana Prado" }).click()

    await expect(panel).toBeHidden()
    expect(store.tasks.find((t) => t.id === "task-1")?.ownerUserName).toBe("Ana Prado")
  })

  test("SDR não vê Reatribuir no ⋯", async ({ page }) => {
    await openTasks(page, undefined, "&aba=atrasadas", "Sdr")
    await openMenu(page, "task-1")
    await expect(page.getByRole("menuitem", { name: "Registrar atividade" })).toBeVisible()
    await expect(page.getByRole("menuitem", { name: "Reatribuir" })).toHaveCount(0)
  })
})

test.describe("seleção e ações em massa", () => {
  // A caixa do cabeçalho e o Shift+clique são da tabela (≥ 768px); os cards do celular são da T4.
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 768, "só tabela")

  test("lote com falha parcial avisa, revalida e mantém marcadas só as que falharam", async ({ page }) => {
    const store = new TaskStore()
    store.outOfReach.add("task-3")
    await openTasks(page, store, "&aba=atrasadas")

    await page.getByRole("checkbox", { name: "Selecionar todas as tarefas da página" }).check()
    const bar = page.getByRole("region", { name: "Ações em massa" })
    await expect(bar).toContainText("3 selecionadas")

    await bar.getByRole("button", { name: "Concluir" }).click()

    await expect(page.getByRole("status").filter({ hasText: "2 concluídas · 1 não pôde ser alterada" })).toBeVisible()
    expect(store.bulkRequests.at(-1)).toMatchObject({ action: "Complete" })
    await page.getByText("Ver motivos").click()
    await expect(page.getByText("não encontrada ou fora do seu alcance")).toBeVisible()
    await expect(rows(page)).toHaveCount(1)
    await expect(bar).toContainText("1 selecionada")
  })

  test("Shift+clique seleciona o intervalo e trocar de aba limpa a seleção", async ({ page }) => {
    await openTasks(page)
    const boxes = rows(page).getByRole("checkbox")
    await boxes.nth(0).click()
    await boxes.nth(3).click({ modifiers: ["Shift"] })
    await expect(page.getByRole("region", { name: "Ações em massa" })).toContainText("4 selecionadas")
    await expect(page.getByRole("checkbox", { name: "Selecionar todas as tarefas da página" })).toHaveJSProperty("indeterminate", true)

    await page.getByRole("tab", { name: /Hoje/ }).click()
    await expect(page.getByRole("region", { name: "Ações em massa" })).toHaveCount(0)
  })
})

test.describe("coluna lateral", () => {
  test("clicar num dia do calendário muda a data de referência e ativa a aba Hoje", async ({ page }) => {
    const store = await openTasks(page)
    const calendar = page.getByRole("complementary", { name: "Calendário e resumo" })
    // 13/09 tem uma tarefa atrasada: o nome acessível diz quantas.
    await expect(calendar.getByRole("button", { name: /13 de setembro.*1 tarefa, 1 atrasada/ })).toBeVisible()

    await calendar.getByRole("button", { name: /18 de setembro/ }).click()

    await expect(page.getByRole("tab", { name: /Hoje/ })).toHaveAttribute("aria-selected", "true")
    await expect(page).toHaveURL(/data=2026-09-18/)
    expect(store.listRequests.at(-1)?.get("referenceDate")).toBe("2026-09-18")
    expect(store.listRequests.at(-1)?.get("scope")).toBe("Today")
  })

  test("clicar na legenda do donut ativa a aba — Concluídas vira Todas com o filtro", async ({ page }) => {
    const store = await openTasks(page)
    const legend = page.getByRole("list", { name: "Tarefas por status" })
    await legend.getByRole("button", { name: /^Atrasadas/ }).click()
    await expect(page.getByRole("tab", { name: /Atrasadas/ })).toHaveAttribute("aria-selected", "true")

    await legend.getByRole("button", { name: /^Concluídas/ }).click()
    await expect(page.getByRole("tab", { name: /Todas/ })).toHaveAttribute("aria-selected", "true")
    expect(store.listRequests.at(-1)?.getAll("statuses")).toEqual(["Concluida"])
  })

  const highlights = [
    { week: { completedThisWeek: 67, completedPreviousWeek: 50, completedChangePct: 34 }, text: "Você concluiu 34% mais tarefas nesta semana do que na anterior." },
    { week: { completedThisWeek: 44, completedPreviousWeek: 50, completedChangePct: -12 }, text: "Você concluiu 12% menos tarefas nesta semana do que na anterior." },
    { week: { completedThisWeek: 8, completedPreviousWeek: 8, completedChangePct: 0 }, text: "Mesmo ritmo da semana anterior: 8 tarefas concluídas." },
    { week: { completedThisWeek: 5, completedPreviousWeek: 0, completedChangePct: null }, text: "5 tarefas concluídas nos últimos 7 dias." },
  ]
  for (const { week, text } of highlights) {
    test(`destaques: ${text}`, async ({ page }) => {
      const store = new TaskStore()
      store.week = { ...store.week, ...week }
      await openTasks(page, store)
      await expect(page.getByTestId("weekly-highlight")).toHaveText(text)
    })
  }
})

test.describe("layout", () => {

  for (const width of [1366, 1600, 1920]) {
    test(`${width}px: sem rolagem horizontal e a lateral não espreme a tabela`, async ({ page }, testInfo) => {
      // As três larguras são forçadas aqui: basta rodar num projeto.
      test.skip(testInfo.project.name !== "1366x768", "roda uma vez")
      await page.setViewportSize({ width, height: width === 1366 ? 768 : 1000 })
      await openTasks(page, undefined, "&responsavel=todos")
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
      const table = await page.getByRole("table", { name: "Tarefas", exact: true }).boundingBox()
      expect(table?.width ?? 0).toBeGreaterThanOrEqual(760)
    })
  }
})
