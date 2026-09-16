import { describe, expect, it } from "vitest"

import { closeRate, comparisonRange, deltaOf, deltaPoints, smoothSeries, type DeltaContext } from "./dashboard-format"

/** Janela de 30 dias com histórico bem anterior: existe base de comparação. */
const withBaseline: DeltaContext = {
  historyStart: "2026-01-10T00:00:00Z",
  previousStart: "2026-07-18T03:00:00Z",
  periodStart: "2026-08-17T03:00:00Z",
}

describe("deltaOf", () => {
  it("dá o percentual contra a janela anterior", () => {
    expect(deltaOf({ current: 150, previous: 100 }, withBaseline)).toEqual({
      kind: "change",
      direction: "up",
      label: "+50%",
    })
  })

  it("usa o sinal de menos tipográfico na queda", () => {
    const delta = deltaOf({ current: 50, previous: 100 }, withBaseline)
    expect(delta).toMatchObject({ kind: "change", direction: "down" })
    expect(delta).toHaveProperty("label", "−50%")
  })

  it("trata variação desprezível como estável", () => {
    expect(deltaOf({ current: 1000.2, previous: 1000 }, withBaseline)).toEqual({
      kind: "change",
      direction: "flat",
      label: "0%",
    })
  })

  it("sem janela anterior, distingue 'novo' de 'parado'", () => {
    expect(deltaOf({ current: 10, previous: 0 }, withBaseline)).toEqual({ kind: "new" })
    expect(deltaOf({ current: 0, previous: 0 }, withBaseline)).toEqual({ kind: "idle" })
  })

  it("não compara quando o histórico começa dentro do período", () => {
    const noHistory: DeltaContext = { ...withBaseline, historyStart: "2026-08-20T00:00:00Z" }
    expect(deltaOf({ current: 10, previous: 5 }, noHistory)).toEqual({ kind: "no-history" })
  })

  it("não compara quando a organização não tem nenhum negócio", () => {
    expect(deltaOf({ current: 0, previous: 0 }, { ...withBaseline, historyStart: null })).toEqual({ kind: "no-history" })
  })
})

describe("deltaPoints", () => {
  it("mede taxas em pontos percentuais, não em % de %", () => {
    expect(deltaPoints(0.5, 0.4, withBaseline)).toEqual({ kind: "change", direction: "up", label: "+10 p.p." })
  })

  it("arredonda para uma casa e usa o sinal tipográfico", () => {
    expect(deltaPoints(0.3333, 0.5, withBaseline)).toMatchObject({ direction: "down", label: "−16,7 p.p." })
  })

  it("sem taxa anterior, é 'novo' só se agora existe taxa", () => {
    expect(deltaPoints(0.5, null, withBaseline)).toEqual({ kind: "new" })
    expect(deltaPoints(null, null, withBaseline)).toEqual({ kind: "idle" })
    expect(deltaPoints(null, 0.5, withBaseline)).toEqual({ kind: "idle" })
  })

  it("diferença desprezível vira 0 p.p.", () => {
    expect(deltaPoints(0.50004, 0.5, withBaseline)).toEqual({ kind: "change", direction: "flat", label: "0 p.p." })
  })
})

describe("comparisonRange", () => {
  it("vai do início da janela anterior até a véspera do período", () => {
    expect(comparisonRange(withBaseline)).toBe("18/07 – 16/08")
  })
})

describe("closeRate", () => {
  it("é ganhos sobre ganhos + perdidos", () => {
    expect(closeRate(3, 1)).toBe(0.75)
  })

  it("é nulo (não zero) quando nada fechou", () => {
    expect(closeRate(0, 0)).toBeNull()
  })

  it("é 1 quando nada foi perdido", () => {
    expect(closeRate(4, 0)).toBe(1)
  })
})

describe("smoothSeries", () => {
  it("devolve a série intacta quando é curta demais para suavizar", () => {
    expect(smoothSeries([1, 9, 2])).toEqual([1, 9, 2])
  })

  it("mantém a primeira e a última ponta no valor real", () => {
    const values = [0, 10, 0, 10, 0, 10, 0, 10]
    const smoothed = smoothSeries(values)
    expect(smoothed[0]).toBe(0)
    expect(smoothed.at(-1)).toBe(10)
  })

  it("reduz a oscilação no meio sem mudar o tamanho da série", () => {
    const values = [0, 10, 0, 10, 0, 10, 0, 10]
    const smoothed = smoothSeries(values)
    expect(smoothed).toHaveLength(values.length)
    const spread = (list: number[]) => Math.max(...list.slice(1, -1)) - Math.min(...list.slice(1, -1))
    expect(spread(smoothed)).toBeLessThan(spread(values))
  })

  it("não inventa valor numa série constante", () => {
    const flat = [5, 5, 5, 5, 5, 5]
    expect(smoothSeries(flat)).toEqual(flat)
  })
})
