import { describe, expect, it } from "vitest"

import { nextFocus, tabStopOf, type FocusGrid } from "./board-keyboard"

// Prospect (3) · Primeiro contato (vazia) · Qualificação (1) · Reunião (2)
const GRID: FocusGrid = [["p1", "p2", "p3"], [], ["q1"], ["r1", "r2"]]

describe("setas no quadro", () => {
  it("↑/↓ andam na coluna e param nas bordas", () => {
    expect(nextFocus(GRID, "p1", "ArrowDown")).toBe("p2")
    expect(nextFocus(GRID, "p2", "ArrowUp")).toBe("p1")
    expect(nextFocus(GRID, "p1", "ArrowUp")).toBeNull()
    expect(nextFocus(GRID, "p3", "ArrowDown")).toBeNull()
  })

  it("←/→ pulam a coluna vazia e mantêm a altura, ou caem na última linha", () => {
    expect(nextFocus(GRID, "p3", "ArrowRight")).toBe("q1")
    expect(nextFocus(GRID, "q1", "ArrowRight")).toBe("r1")
    expect(nextFocus(GRID, "r2", "ArrowLeft")).toBe("q1")
    expect(nextFocus(GRID, "q1", "ArrowLeft")).toBe("p1")
    expect(nextFocus(GRID, "r1", "ArrowRight")).toBeNull()
  })

  it("cartão que sumiu da tela devolve o foco ao primeiro", () => {
    expect(nextFocus(GRID, "x", "ArrowDown")).toBe("p1")
  })

  it("Tab entra no último cartão focado, se ele ainda está na tela", () => {
    expect(tabStopOf(GRID, "r2")).toBe("r2")
    expect(tabStopOf(GRID, "sumiu")).toBe("p1")
    expect(tabStopOf([[], []], null)).toBeNull()
  })
})
