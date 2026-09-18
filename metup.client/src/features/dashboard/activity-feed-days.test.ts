import { dayLabel, groupByDay } from "./activity-feed-days"
import type { RecentEvent } from "./api"

function event(id: string, occurredAt: string, occurredOnLocal: string): RecentEvent {
  return {
    id,
    kind: "Activity",
    dealId: "d1",
    companyName: "Padaria Aurora",
    actorName: "Davi",
    occurredAt,
    occurredOnLocal,
    toStage: null,
    activityType: "Note",
    outcome: null,
    amount: null,
  }
}

describe("dayLabel", () => {
  it("usa o hoje da organização para Hoje e Ontem", () => {
    expect(dayLabel("2026-09-15", "2026-09-15")).toBe("Hoje")
    expect(dayLabel("2026-09-14", "2026-09-15")).toBe("Ontem")
  })

  it("Ontem atravessa a virada do mês", () => {
    expect(dayLabel("2026-09-30", "2026-10-01")).toBe("Ontem")
  })

  it("mostra o dia por extenso, com o ano só fora do ano corrente", () => {
    expect(dayLabel("2026-09-12", "2026-09-15")).toBe("12 de setembro")
    expect(dayLabel("2025-12-31", "2026-01-02")).toBe("31 de dezembro de 2025")
  })
})

describe("groupByDay", () => {
  it("agrupa pelo dia local vindo do servidor, não pelo instante UTC", () => {
    // 23h30 de 14/09 em Brasília é 02h30 de 15/09 em UTC: o servidor manda 14/09, e é isso que vale.
    const groups = groupByDay(
      [
        event("a", "2026-09-15T13:00:00Z", "2026-09-15"),
        event("b", "2026-09-15T02:30:00Z", "2026-09-14"),
        event("c", "2026-09-14T20:00:00Z", "2026-09-14"),
        event("d", "2026-09-12T15:00:00Z", "2026-09-12"),
      ],
      "2026-09-15"
    )

    expect(groups.map((g) => [g.label, g.events.map((e) => e.id)])).toEqual([
      ["Hoje", ["a"]],
      ["Ontem", ["b", "c"]],
      ["12 de setembro", ["d"]],
    ])
  })

  it("lista vazia não tem grupo", () => {
    expect(groupByDay([], "2026-09-15")).toEqual([])
  })
})
