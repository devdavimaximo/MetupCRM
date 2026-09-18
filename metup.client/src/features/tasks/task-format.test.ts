import { describe, expect, it } from "vitest"

import { countDelta, deltaTone } from "@/features/dashboard/dashboard-format"
import {
  dueShortcuts,
  formatOverdueSince,
  formatTaskDue,
  nextFullHour,
  nextMondayAt,
  pageItems,
  parseTasksUrl,
  rangeLabel,
  serializeTasksUrl,
  type RawTasksUrl,
} from "./task-format"

/** Instantes montados no horário local, como o navegador os vê. */
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString()
const NOW = new Date(2026, 8, 18, 14, 30)

describe("formatTaskDue", () => {
  it("usa Hoje, Amanhã e Ontem com a hora", () => {
    expect(formatTaskDue(local(2026, 9, 18, 10), NOW)).toBe("Hoje · 10:00")
    expect(formatTaskDue(local(2026, 9, 19, 9), NOW)).toBe("Amanhã · 09:00")
    expect(formatTaskDue(local(2026, 9, 17, 17), NOW)).toBe("Ontem · 17:00")
  })

  it("mostra dia/mês nos outros dias e o ano só quando muda", () => {
    expect(formatTaskDue(local(2026, 9, 16, 10), NOW)).toBe("16/09 · 10:00")
    expect(formatTaskDue(local(2026, 10, 2, 8, 15), NOW)).toBe("02/10 · 08:15")
    expect(formatTaskDue(local(2027, 1, 5, 9), NOW)).toBe("05/01/2027 · 09:00")
  })

  it("conta dia de calendário na fronteira da meia-noite, não blocos de 24h", () => {
    const lateNight = new Date(2026, 8, 18, 23, 59)
    expect(formatTaskDue(local(2026, 9, 19, 0, 1), lateNight)).toBe("Amanhã · 00:01")
    const justAfterMidnight = new Date(2026, 8, 19, 0, 1)
    expect(formatTaskDue(local(2026, 9, 18, 23, 59), justAfterMidnight)).toBe("Ontem · 23:59")
  })
})

describe("formatOverdueSince", () => {
  it("diz há quanto tempo venceu", () => {
    expect(formatOverdueSince(local(2026, 9, 16, 10), NOW)).toBe("há 2 dias")
    expect(formatOverdueSince(local(2026, 9, 17, 18), NOW)).toBe("há 1 dia")
    expect(formatOverdueSince(local(2026, 9, 18, 11), NOW)).toBe("há 3h")
    expect(formatOverdueSince(local(2026, 9, 18, 14, 20), NOW)).toBe("há 10 min")
  })

  it("é null antes do prazo", () => {
    expect(formatOverdueSince(local(2026, 9, 18, 15), NOW)).toBeNull()
  })
})

describe("pageItems", () => {
  it("lista tudo até 7 páginas", () => {
    expect(pageItems(1, 1)).toEqual([1])
    expect(pageItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("põe reticências dos dois lados no meio", () => {
    expect(pageItems(5, 24)).toEqual([1, "ellipsis-start", 4, 5, 6, "ellipsis-end", 24])
  })

  it("perto das pontas mantém o mesmo número de itens", () => {
    expect(pageItems(1, 24)).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 24])
    expect(pageItems(3, 24)).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 24])
    expect(pageItems(24, 24)).toEqual([1, "ellipsis-start", 20, 21, 22, 23, 24])
  })

  it("nunca troca uma única página escondida por reticências", () => {
    expect(pageItems(4, 8)).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 8])
    expect(pageItems(5, 8)).toEqual([1, "ellipsis-start", 4, 5, 6, 7, 8])
  })
})

describe("rangeLabel", () => {
  it("resume o recorte da página", () => {
    expect(rangeLabel(1, 10, 239)).toBe("Mostrando 1–10 de 239 tarefas")
    expect(rangeLabel(24, 10, 239)).toBe("Mostrando 231–239 de 239 tarefas")
    expect(rangeLabel(1, 10, 1)).toBe("Mostrando 1–1 de 1 tarefa")
    expect(rangeLabel(1, 10, 0)).toBe("Nenhuma tarefa")
  })
})

const empty: RawTasksUrl = {
  tab: "",
  page: "",
  pageSize: "",
  date: "",
  owner: "",
  legacyStatus: "",
  legacyDueFrom: "",
  legacyDueTo: "",
}

describe("parseTasksUrl", () => {
  it("sem nada, abre Todas na página 1, de 10, minhas tarefas, hoje", () => {
    expect(parseTasksUrl(empty, true)).toEqual({
      tab: "All",
      page: 1,
      pageSize: 10,
      referenceDate: null,
      owner: { kind: "mine" },
      statuses: [],
    })
  })

  it("lê aba, página, tamanho, data e responsável", () => {
    const state = parseTasksUrl({ ...empty, tab: "atrasadas", page: "3", pageSize: "25", date: "2026-09-20", owner: "todos" }, true)
    expect(state).toMatchObject({ tab: "Overdue", page: 3, pageSize: 25, referenceDate: "2026-09-20", owner: { kind: "all" } })
    expect(parseTasksUrl({ ...empty, owner: "user-2" }, true).owner).toEqual({ kind: "user", userId: "user-2" })
  })

  it("descarta valores inválidos em vez de quebrar", () => {
    const state = parseTasksUrl({ ...empty, tab: "xyz", page: "-2", pageSize: "13", date: "2026-02-31" }, true)
    expect(state).toMatchObject({ tab: "All", page: 1, pageSize: 10, referenceDate: null })
  })

  it("SDR nunca herda responsável da URL", () => {
    expect(parseTasksUrl({ ...empty, owner: "todos" }, false).owner).toEqual({ kind: "mine" })
    expect(parseTasksUrl({ ...empty, owner: "user-2" }, false).owner).toEqual({ kind: "mine" })
  })

  it("converte o link antigo status=Concluida no filtro de status da aba Todas", () => {
    expect(parseTasksUrl({ ...empty, legacyStatus: "Concluida" }, true)).toMatchObject({ tab: "All", statuses: ["Concluida"] })
    expect(parseTasksUrl({ ...empty, legacyStatus: "Pendente" }, true)).toMatchObject({ tab: "All", statuses: [] })
  })

  it("converte prazoDe/prazoAte na data de referência", () => {
    expect(parseTasksUrl({ ...empty, legacyDueFrom: "2026-09-10", legacyDueTo: "2026-09-10" }, true)).toMatchObject({
      tab: "Today",
      referenceDate: "2026-09-10",
    })
    expect(parseTasksUrl({ ...empty, legacyDueFrom: "2026-09-10", legacyDueTo: "2026-09-20" }, true)).toMatchObject({
      tab: "All",
      referenceDate: "2026-09-10",
    })
    expect(parseTasksUrl({ ...empty, legacyDueTo: "2026-09-20" }, true)).toMatchObject({ referenceDate: "2026-09-20" })
  })

  it("a chave nova vence a antiga", () => {
    const state = parseTasksUrl({ ...empty, tab: "semana", date: "2026-09-25", legacyDueFrom: "2026-09-10" }, true)
    expect(state).toMatchObject({ tab: "ThisWeek", referenceDate: "2026-09-25" })
  })
})

describe("serializeTasksUrl", () => {
  it("omite o padrão e sempre limpa as chaves antigas", () => {
    expect(
      serializeTasksUrl({ tab: "All", page: 1, pageSize: 10, referenceDate: "2026-09-18", owner: { kind: "mine" } }, "2026-09-18")
    ).toEqual({ tasksTab: "", tasksPage: "", tasksPageSize: "", tasksDate: "", ownerUserId: "", taskStatus: "", dueFrom: "", dueTo: "" })
  })

  it("escreve o que foge do padrão", () => {
    expect(
      serializeTasksUrl({ tab: "Later", page: 2, pageSize: 50, referenceDate: "2026-09-20", owner: { kind: "all" } }, "2026-09-18")
    ).toMatchObject({ tasksTab: "depois", tasksPage: "2", tasksPageSize: "50", tasksDate: "2026-09-20", ownerUserId: "todos" })
  })
})

describe("atalhos de prazo", () => {
  it("próxima hora cheia", () => {
    expect(nextFullHour(new Date(2026, 8, 18, 14, 20))).toEqual(new Date(2026, 8, 18, 15, 0))
    expect(nextFullHour(new Date(2026, 8, 18, 14, 0))).toEqual(new Date(2026, 8, 18, 15, 0))
  })

  it("próxima segunda — numa segunda, a da semana que vem", () => {
    expect(nextMondayAt(new Date(2026, 8, 18, 10))).toEqual(new Date(2026, 8, 21, 9)) // sexta → segunda 21
    expect(nextMondayAt(new Date(2026, 8, 21, 10))).toEqual(new Date(2026, 8, 28, 9)) // segunda → 28
    expect(nextMondayAt(new Date(2026, 8, 20, 10))).toEqual(new Date(2026, 8, 21, 9)) // domingo → amanhã
  })

  it("atalho que já passou não aparece", () => {
    const evening = new Date(2026, 8, 18, 19)
    expect(dueShortcuts(evening, "evening").map((s) => s.id)).toEqual(["tomorrow", "plus3", "monday"])
    const lateNight = new Date(2026, 8, 18, 23, 30)
    expect(dueShortcuts(lateNight, "next-hour").map((s) => s.id)).toEqual(["tomorrow", "plus3", "monday"])
    expect(dueShortcuts(NOW, "next-hour")[0]).toMatchObject({ id: "today", date: new Date(2026, 8, 18, 15) })
  })
})

describe("delta dos KPIs", () => {
  it("em Atrasadas, subir é ruim e descer é bom", () => {
    expect(deltaTone("up", "higher-is-worse")).toBe("negative")
    expect(deltaTone("down", "higher-is-worse")).toBe("positive")
    expect(deltaTone("flat", "higher-is-worse")).toBe("neutral")
  })

  it("em volume (Hoje, Esta semana) a cor é neutra nas duas direções", () => {
    expect(deltaTone("up", "neutral")).toBe("neutral")
    expect(deltaTone("down", "neutral")).toBe("neutral")
  })

  it("o padrão do dashboard continua: subir é bom", () => {
    expect(deltaTone("up")).toBe("positive")
    expect(deltaTone("down")).toBe("negative")
  })

  it("variação absoluta e percentual; sem base anterior quando previous é null", () => {
    expect(countDelta(46, 41)).toEqual({ kind: "change", direction: "up", label: "+5 · +12,2%" })
    expect(countDelta(28, 32)).toEqual({ kind: "change", direction: "down", label: "−4 · −12,5%" })
    expect(countDelta(3, 3)).toEqual({ kind: "change", direction: "flat", label: "0 · 0%" })
    expect(countDelta(3, 0)).toEqual({ kind: "change", direction: "up", label: "+3" })
    expect(countDelta(3, null)).toEqual({ kind: "no-base" })
  })
})
