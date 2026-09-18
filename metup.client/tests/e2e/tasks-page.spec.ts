import type { Page } from "@playwright/test"

import { data, expect, gotoTasks, installApi, problem, TaskStore, test } from "./fixtures/app"

/** Largura em que a tela monta a tabela (≥ 768px); abaixo, cards. */
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 768

/** As linhas da lista, na tabela ou nos cards. */
function rows(page: Page) {
  return page.getByRole("tabpanel").locator("[data-task-id]")
}

async function openTasks(page: Page, store = new TaskStore(), overrides: Parameters<typeof installApi>[1] = {}, query = "") {
  await installApi(page, { ...store.routes(), ...overrides })
  await gotoTasks(page, query)
  await expect(rows(page).first()).toBeVisible()
  return store
}

test.describe("abas e KPIs", () => {
  test("trocar de aba muda o recorte, volta para a página 1 e vai para a URL", async ({ page }) => {
    const store = await openTasks(page)
    await expect(page.getByText("Mostrando 1–10 de 25 tarefas")).toBeVisible()

    await page.getByRole("button", { name: "Próxima página" }).click()
    await expect(page.getByText("Mostrando 11–20 de 25 tarefas")).toBeVisible()
    await expect(page).toHaveURL(/pagina=2/)

    await page.getByRole("tab", { name: /Atrasadas/ }).click()
    await expect(page.getByRole("tab", { name: /Atrasadas/ })).toHaveAttribute("aria-selected", "true")
    await expect(rows(page)).toHaveCount(3)
    await expect(page).toHaveURL(/aba=atrasadas/)
    await expect(page).not.toHaveURL(/pagina=/)
    expect(store.listRequests.at(-1)?.get("scope")).toBe("Overdue")
    expect(store.listRequests.at(-1)?.get("page")).toBe("1")
  })

  test("as abas andam pelas setas do teclado", async ({ page }) => {
    await openTasks(page)
    await page.getByRole("tab", { name: /Todas/ }).focus()
    await page.keyboard.press("ArrowRight")
    await expect(page.getByRole("tab", { name: /Atrasadas/ })).toBeFocused()
    await expect(page.getByRole("tab", { name: /Atrasadas/ })).toHaveAttribute("aria-selected", "true")
    await page.keyboard.press("End")
    await expect(page.getByRole("tab", { name: /Mais tarde/ })).toHaveAttribute("aria-selected", "true")
  })

  test("o KPI é um botão que ativa a aba e mostra a variação contra a semana anterior", async ({ page }) => {
    await openTasks(page)
    const kpi = page.getByRole("button", { name: /^Atrasadas/ })
    await expect(kpi).toContainText("3")
    // 3 contra 2 na semana anterior: subir em Atrasadas é ruim → vermelho.
    await expect(kpi.getByText("+1 · +50%")).toHaveClass(/text-danger/)
    await expect(page.getByRole("button", { name: /^Hoje/ }).getByText("0 · 0%")).toHaveClass(/text-fg-muted/)

    await kpi.click()
    await expect(kpi).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByRole("tab", { name: /Atrasadas/ })).toHaveAttribute("aria-selected", "true")
  })

  test("erro do resumo não derruba a lista", async ({ page }) => {
    const store = new TaskStore()
    await openTasks(page, store, { taskSummary: problem("Resumo indisponível.", 503) })
    await expect(page.getByRole("alert").filter({ hasText: "Resumo indisponível." })).toBeVisible()
    await expect(page.getByText("Mostrando 1–10 de 25 tarefas")).toBeVisible()
  })
})

test.describe("filtros e ordenação", () => {
  test("filtro por tipo reduz a lista, conta no botão, esmaece as outras abas e limpa", async ({ page }) => {
    const store = await openTasks(page)
    await page.getByRole("button", { name: "Filtros" }).click()
    await page.getByRole("group", { name: "Tipo de atividade" }).getByRole("button", { name: "Reunião" }).click()
    await page.keyboard.press("Escape")

    await expect(page.getByRole("button", { name: "Filtros (1 ativos)" })).toBeVisible()
    expect(store.listRequests.at(-1)?.getAll("types")).toEqual(["Meeting"])
    const meetings = store.tasks.filter((t) => t.type === "Meeting" && t.status !== "Cancelada").length
    await expect(page.getByText(`de ${meetings} tarefa`)).toBeVisible()
    // A contagem da aba ativa segue a lista; as outras são do resumo, sem filtro.
    await expect(page.getByRole("tab", { name: /Todas/ })).toContainText(String(meetings))
    await expect(page.getByRole("tab", { name: /Atrasadas/ })).toContainText("sem filtros")

    await page.getByRole("button", { name: "Limpar filtros" }).first().click()
    await expect(page.getByText("Mostrando 1–10 de 25 tarefas")).toBeVisible()
    await expect(page.getByRole("button", { name: "Filtros", exact: true })).toBeVisible()
  })

  test("status só vale na aba Todas", async ({ page }) => {
    await openTasks(page, new TaskStore(), {}, "&aba=hoje")
    await page.getByRole("button", { name: "Filtros" }).click()
    await expect(page.getByRole("group", { name: "Status" }).getByRole("button", { name: "Concluída" })).toBeDisabled()
    await expect(page.getByText("Só na aba Todas")).toBeVisible()
  })

  test("busca com debounce manda o termo uma vez", async ({ page }) => {
    const store = await openTasks(page)
    await page.getByRole("button", { name: "Filtros" }).click()
    await page.getByPlaceholder("Empresa ou nota…").fill("bonfim")
    await expect.poll(() => store.listRequests.at(-1)?.get("search")).toBe("bonfim")
    expect(store.listRequests.filter((r) => r.get("search")).length).toBe(1)
  })

  test("cabeçalho Prazo alterna a ordem e expõe aria-sort", async ({ page }) => {
    test.skip(!isDesktop(page), "Cabeçalhos de coluna só existem na tabela.")
    const store = await openTasks(page)
    const due = page.getByRole("columnheader", { name: /Prazo/ })
    await expect(due).toHaveAttribute("aria-sort", "ascending")

    await due.getByRole("button").click()
    await expect(due).toHaveAttribute("aria-sort", "descending")
    expect(store.listRequests.at(-1)?.get("sort")).toBe("DueDesc")

    await page.getByRole("columnheader", { name: /Status/ }).getByRole("button").click()
    await expect(page.getByRole("columnheader", { name: /Status/ })).toHaveAttribute("aria-sort", "ascending")
    await expect(due).toHaveAttribute("aria-sort", "none")
  })

  test("o menu de ordenação troca para Mais recentes", async ({ page }) => {
    const store = await openTasks(page)
    await page.getByRole("button", { name: /Ordenar por/ }).click()
    await page.getByRole("menuitem", { name: "Mais recentes" }).click()
    await expect.poll(() => store.listRequests.at(-1)?.get("sort")).toBe("Recent")
  })
})

test.describe("paginação", () => {
  test("páginas numeradas, aria-current e tamanho da página", async ({ page }) => {
    const store = await openTasks(page)
    const nav = page.getByRole("navigation", { name: "Paginação" })
    await expect(nav.getByRole("button", { name: "Página 1" })).toHaveAttribute("aria-current", "page")

    await nav.getByRole("button", { name: "Página 3" }).click()
    await expect(page.getByText("Mostrando 21–25 de 25 tarefas")).toBeVisible()
    await expect(nav.getByRole("button", { name: "Página 3" })).toHaveAttribute("aria-current", "page")

    await page.getByRole("button", { name: "10 por página" }).click()
    await page.getByRole("menuitem", { name: "25 por página" }).click()
    await expect(page.getByText("Mostrando 1–25 de 25 tarefas")).toBeVisible()
    expect(store.listRequests.at(-1)?.get("pageSize")).toBe("25")
    await expect(page.getByRole("navigation", { name: "Paginação" })).toBeHidden()
  })
})

test.describe("ações na linha", () => {
  test("concluir tira a linha do recorte e atualiza o KPI", async ({ page }) => {
    await openTasks(page, new TaskStore(), {}, "&aba=atrasadas")
    await expect(rows(page)).toHaveCount(3)
    const kpi = page.getByRole("button", { name: /^Atrasadas/ })
    await expect(kpi).toContainText("3")

    await page.getByRole("button", { name: /^Concluir:/ }).first().click()
    await expect(rows(page)).toHaveCount(2)
    await expect(kpi.locator("p.text-2xl")).toHaveText("2")
    await expect(page.getByRole("tab", { name: /Atrasadas/ })).toContainText("2")
  })

  test("reagendar pelo menu ⋯ com atalho", async ({ page }) => {
    const store = await openTasks(page, new TaskStore(), {}, "&aba=atrasadas")
    await page.getByRole("button", { name: /^Mais ações:/ }).first().click()
    await page.getByRole("menuitem", { name: "Reagendar" }).click()
    await page.getByRole("dialog", { name: /^Reagendar:/ }).getByRole("button", { name: "Amanhã 9h" }).click()

    await expect(rows(page)).toHaveCount(2)
    const moved = store.tasks.find((t) => t.id === "task-1")
    expect(moved && new Date(moved.dueDate).toISOString()).toBe(new Date("2026-09-16T09:00:00-03:00").toISOString())
  })

  test("cancelar pede confirmação", async ({ page }) => {
    const store = await openTasks(page, new TaskStore(), {}, "&aba=atrasadas")
    await page.getByRole("button", { name: /^Mais ações:/ }).first().click()
    await page.getByRole("menuitem", { name: "Cancelar tarefa" }).click()
    const confirm = page.getByRole("dialog", { name: /^Cancelar:/ })
    await expect(confirm).toContainText("Cancelar esta tarefa?")
    await expect(confirm.getByRole("button", { name: "Voltar" })).toBeFocused()

    await confirm.getByRole("button", { name: "Voltar" }).click()
    expect(store.tasks.find((t) => t.id === "task-1")?.status).toBe("Pendente")

    await page.getByRole("button", { name: /^Mais ações:/ }).first().click()
    await page.getByRole("menuitem", { name: "Cancelar tarefa" }).click()
    await page.getByRole("dialog", { name: /^Cancelar:/ }).getByRole("button", { name: "Cancelar tarefa" }).click()
    await expect(rows(page)).toHaveCount(2)
  })
})

test.describe("nova tarefa", () => {
  async function fillNewTask(page: Page) {
    await page.getByRole("button", { name: "Nova tarefa" }).click()
    const dialog = page.getByRole("dialog", { name: "Nova tarefa" })
    await expect(dialog.getByRole("searchbox", { name: /Negócio/ })).toBeFocused()
    await dialog.getByRole("searchbox", { name: /Negócio/ }).fill("aurora")
    // Só o negócio aberto aparece; o ganho (deal-9) fica de fora.
    await expect(dialog.getByRole("option")).toHaveCount(1)
    await dialog.getByRole("option", { name: /Padaria Aurora/ }).click()
    await dialog.getByRole("radio", { name: "Reunião" }).click()
    await dialog.getByRole("button", { name: "Amanhã 9h" }).click()
    await dialog.getByLabel("Observação").fill("Levar a proposta impressa")
    return dialog
  }

  test("cria, fecha, anuncia e recarrega a lista e o resumo", async ({ page }) => {
    const store = await openTasks(page)
    const dialog = await fillNewTask(page)
    await dialog.getByRole("button", { name: "Criar tarefa" }).click()

    await expect(dialog).toBeHidden()
    await expect(page.getByRole("status").filter({ hasText: "Tarefa criada: Reunião com Padaria Aurora." })).toBeAttached()
    await expect(page.getByRole("tab", { name: /Todas/ })).toContainText("26")
    expect(store.tasks.at(-1)).toMatchObject({ dealId: "deal-1", type: "Meeting", note: "Levar a proposta impressa" })
    await expect(page.getByRole("button", { name: "Nova tarefa" })).toBeFocused()
  })

  test("409 de negócio fechado vira mensagem no campo", async ({ page }) => {
    await openTasks(page, new TaskStore(), { createTask: problem("Negócio fechado.", 409) })
    const dialog = await fillNewTask(page)
    await dialog.getByRole("button", { name: "Criar tarefa" }).click()
    // A frase fica no campo e também no anúncio da região viva: a visível é a primeira.
    await expect(dialog.getByText("Este negócio está fechado. Escolha um negócio em aberto.").first()).toBeVisible()
    await expect(dialog).toBeVisible()
  })

  test("Esc com dado preenchido pergunta antes de descartar", async ({ page }) => {
    await openTasks(page)
    const dialog = await fillNewTask(page)
    await page.keyboard.press("Escape")
    await expect(dialog.getByRole("alertdialog", { name: "Descartar a tarefa?" })).toBeVisible()
    await dialog.getByRole("button", { name: "Descartar" }).click()
    await expect(dialog).toBeHidden()
  })
})

test.describe("papéis e URL", () => {
  test("SDR não vê seletor de responsável nem coluna e nunca pede os outros", async ({ page }) => {
    const store = new TaskStore()
    await installApi(page, store.routes())
    await page.addInitScript((session) => {
      window.localStorage.setItem("metup.session", JSON.stringify({ ...session, user: { ...session.user, role: "Sdr" } }))
    }, data.session)
    await gotoTasks(page, "&responsavel=todos")
    await expect(rows(page).first()).toBeVisible()

    await expect(page.getByRole("button", { name: /^Responsável:/ })).toHaveCount(0)
    await expect(page.getByRole("columnheader", { name: /Responsável/ })).toHaveCount(0)
    for (const params of [...store.listRequests, ...store.summaryRequests]) {
      expect(params.get("allOwners")).toBeNull()
      expect(params.get("ownerUserId")).toBeNull()
    }
  })

  test("Admin escolhe todos os responsáveis e a coluna aparece", async ({ page }) => {
    const store = await openTasks(page)
    await page.getByRole("button", { name: /^Responsável:/ }).click()
    await page.getByRole("option", { name: "Todos os responsáveis" }).click()
    await expect.poll(() => store.listRequests.at(-1)?.get("allOwners")).toBe("true")
    await expect(page).toHaveURL(/responsavel=todos/)
    if (isDesktop(page)) await expect(page.getByRole("columnheader", { name: /Responsável/ })).toBeVisible()
  })

  test("link antigo status=Concluida vira o filtro de status e sai da URL", async ({ page }) => {
    const store = await openTasks(page, new TaskStore(), {}, "&status=Concluida")
    expect(store.listRequests.at(-1)?.getAll("statuses")).toEqual(["Concluida"])
    await expect(rows(page)).toHaveCount(2)
    await expect(page).not.toHaveURL(/status=/)
  })
})

test.describe("layout", () => {
  test("1366×768 sem rolagem horizontal", async ({ page }) => {
    test.skip(page.viewportSize()?.width !== 1366, "A regra é da largura mais estreita com tabela.")
    await openTasks(page, new TaskStore(), {}, "&responsavel=todos")
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBe(0)
    const table = page.getByRole("table")
    const tableOverflow = await table.evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(tableOverflow).toBeLessThanOrEqual(0)
  })

  test("390×844 renderiza cards, sem tabela", async ({ page }) => {
    test.skip(isDesktop(page), "Cards só abaixo de 768px.")
    await openTasks(page)
    await expect(page.getByRole("table")).toHaveCount(0)
    await expect(page.getByRole("list", { name: "Tarefas" }).getByRole("listitem")).toHaveCount(10)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBe(0)
  })
})
