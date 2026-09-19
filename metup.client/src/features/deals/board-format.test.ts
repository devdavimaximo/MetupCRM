import { describe, expect, it } from "vitest"

import { ageTitle, formatAge, lastTouchOf, stalledLabel } from "./board-format"

const now = new Date("2026-09-19T15:00:00Z")
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe("há Xh", () => {
  it.each([
    [0, "agora"],
    [30_000, "agora"],
    [12 * MIN, "há 12 min"],
    [59 * MIN, "há 59 min"],
    [5 * HOUR, "há 5h"],
    [23 * HOUR + 59 * MIN, "há 23h"],
    [DAY, "há 1d"],
    [44 * DAY, "há 44d"],
    [45 * DAY, "há 2 meses"],
    [420 * DAY, "há 14 meses"],
  ])("%i ms atrás = %s", (ms, text) => {
    expect(formatAge(ago(ms), now)).toBe(text)
  })

  it("relógio adiantado (data no futuro) não vira tempo negativo", () => {
    expect(formatAge(new Date(now.getTime() + 5 * MIN).toISOString(), now)).toBe("agora")
  })
})

describe("de onde vem o tempo", () => {
  it("usa a última atividade quando existe", () => {
    expect(lastTouchOf({ lastActivityAt: ago(HOUR), stageEnteredAt: ago(10 * DAY) })).toEqual({ iso: ago(HOUR), kind: "activity" })
  })

  it("sem atividade, cai para a entrada na etapa (pendência da PL1)", () => {
    expect(lastTouchOf({ lastActivityAt: null, stageEnteredAt: ago(10 * DAY) })).toEqual({ iso: ago(10 * DAY), kind: "stage" })
  })

  it("o title diz a data completa e a origem", () => {
    expect(ageTitle({ lastActivityAt: "2026-09-18T17:03:00Z", stageEnteredAt: ago(DAY) })).toMatch(/^Última atividade em 18 de setembro de 2026/)
    expect(ageTitle({ lastActivityAt: null, stageEnteredAt: "2026-09-01T12:00:00Z" })).toMatch(/^Sem atividade\. Na etapa desde 1 de setembro de 2026/)
  })

  it("selo de parado", () => {
    expect(stalledLabel(12)).toBe("Parado há 12 d")
  })
})
