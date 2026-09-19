import { describe, expect, it } from "vitest"

import { largestRemainderPercents, statusSlices, weeklyHighlight } from "./task-insights"

describe("largestRemainderPercents", () => {
  it("soma sempre 100 e dá o ponto que falta às maiores frações", () => {
    expect(largestRemainderPercents([1, 1, 1])).toEqual([34, 33, 33])
    expect(largestRemainderPercents([2, 3, 5])).toEqual([20, 30, 50])
    const result = largestRemainderPercents([7, 13, 29, 1, 50])
    expect(result.reduce((a, b) => a + b, 0)).toBe(100)
  })

  it("total zero = tudo zero", () => {
    expect(largestRemainderPercents([0, 0])).toEqual([0, 0])
  })
})

describe("statusSlices", () => {
  const counts = { all: 20, overdue: 2, today: 3, thisWeek: 0, later: 5, completed30d: 10, cancelled30d: 4 }

  it("usa as cinco fatias de counts, sem canceladas, e tira as zeradas do anel", () => {
    const { slices, total } = statusSlices(counts)
    expect(total).toBe(20)
    expect(slices.map((s) => [s.key, s.value, s.percent])).toEqual([
      ["overdue", 2, 10],
      ["today", 3, 15],
      ["later", 5, 25],
      ["completed", 10, 50],
    ])
  })

  it("Concluídas leva à aba Todas com o filtro de status Concluída", () => {
    const completed = statusSlices(counts).slices.find((s) => s.key === "completed")
    expect(completed?.target).toEqual({ tab: "All", statuses: ["Concluida"] })
  })

  it("sem nada = anel vazio", () => {
    expect(statusSlices({ all: 0, overdue: 0, today: 0, thisWeek: 0, later: 0, completed30d: 0, cancelled30d: 3 })).toEqual({
      slices: [],
      total: 0,
    })
  })
})

describe("weeklyHighlight", () => {
  const week = (current: number, previous: number, pct: number | null) => ({
    completedThisWeek: current,
    completedPreviousWeek: previous,
    completedChangePct: pct,
  })

  it("subiu, caiu e igual", () => {
    expect(weeklyHighlight(week(67, 50, 34), { kind: "self" })).toBe("Você concluiu 34% mais tarefas nesta semana do que na anterior.")
    expect(weeklyHighlight(week(44, 50, -12), { kind: "self" })).toBe("Você concluiu 12% menos tarefas nesta semana do que na anterior.")
    expect(weeklyHighlight(week(8, 8, 0), { kind: "self" })).toBe("Mesmo ritmo da semana anterior: 8 tarefas concluídas.")
  })

  it("sem base anterior e zero, sempre em 7 dias corridos", () => {
    expect(weeklyHighlight(week(5, 0, null), { kind: "self" })).toBe("5 tarefas concluídas nos últimos 7 dias.")
    expect(weeklyHighlight(week(1, 0, null), { kind: "team" })).toBe("1 tarefa concluída nos últimos 7 dias.")
    expect(weeklyHighlight(week(0, 0, null), { kind: "self" })).toBe("Nenhuma tarefa concluída nos últimos 7 dias.")
  })

  it("troca o sujeito para a equipe ou o responsável escolhido", () => {
    expect(weeklyHighlight(week(3, 2, 50), { kind: "team" })).toMatch(/^A equipe concluiu 50% mais/)
    expect(weeklyHighlight(week(1, 2, -50), { kind: "user", name: "Sofia SDR" })).toMatch(/^Sofia SDR concluiu 50% menos/)
  })
})
