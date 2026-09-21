import { describe, expect, it } from "vitest"

import { carouselPageAt, carouselPageCount, carouselRangeLabel } from "./carousel"

describe("carrossel de KPIs", () => {
  it("dois por página, com a última possivelmente pela metade", () => {
    expect(carouselPageCount(5)).toBe(3)
    expect(carouselPageCount(4)).toBe(2)
    expect(carouselPageCount(0)).toBe(1)
  })

  it("a página vem da rolagem, dentro dos limites", () => {
    expect(carouselPageAt(0, 300, 3)).toBe(0)
    expect(carouselPageAt(320, 300, 3)).toBe(1)
    expect(carouselPageAt(5_000, 300, 3)).toBe(2)
    expect(carouselPageAt(100, 0, 3)).toBe(0)
  })

  it("a posição em texto, com a página final sozinha", () => {
    expect(carouselRangeLabel(0, 5)).toBe("Indicadores 1 e 2 de 5")
    expect(carouselRangeLabel(2, 5)).toBe("Indicador 5 de 5")
  })
})
