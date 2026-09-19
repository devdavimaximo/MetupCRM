import { describe, expect, it } from "vitest"

import { toggleSelection } from "./task-selection"

const page = ["a", "b", "c", "d", "e"]

describe("toggleSelection", () => {
  it("sem Shift alterna só a linha", () => {
    expect([...toggleSelection(new Set(["a"]), page, "c", "a", false)]).toEqual(["a", "c"])
    expect([...toggleSelection(new Set(["a", "c"]), page, "c", "a", false)]).toEqual(["a"])
  })

  it("com Shift marca o intervalo da âncora até a linha, nos dois sentidos", () => {
    expect([...toggleSelection(new Set(["b"]), page, "d", "b", true)].sort()).toEqual(["b", "c", "d"])
    expect([...toggleSelection(new Set(["d"]), page, "a", "d", true)].sort()).toEqual(["a", "b", "c", "d"])
  })

  it("com Shift numa linha marcada desmarca o intervalo", () => {
    expect([...toggleSelection(new Set(page), page, "d", "b", true)].sort()).toEqual(["a", "e"])
  })

  it("âncora fora da página cai para a linha só", () => {
    expect([...toggleSelection(new Set(), page, "c", "zz", true)]).toEqual(["c"])
  })
})
