import { describe, expect, it } from "vitest"

import { isTypingTarget, shortcutKey } from "./shortcuts"

const press = (key: string, patch: Partial<KeyboardEvent> & { target?: EventTarget | null } = {}) =>
  shortcutKey({
    key,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    defaultPrevented: false,
    target: document.body,
    ...patch,
  })

describe("atalhos de tela", () => {
  it("devolve a tecla em minúscula", () => {
    expect(press("n")).toBe("n")
    expect(press("/")).toBe("/")
  })

  it("nada com Ctrl, Alt, Meta ou Shift (menos o ?)", () => {
    expect(press("n", { ctrlKey: true })).toBeNull()
    expect(press("n", { altKey: true })).toBeNull()
    expect(press("n", { metaKey: true })).toBeNull()
    expect(press("N", { shiftKey: true })).toBeNull()
    expect(press("?", { shiftKey: true })).toBe("?")
  })

  it("nada em campo de texto, tecla segurada, composição ou evento já tratado", () => {
    const input = document.createElement("input")
    expect(press("n", { target: input })).toBeNull()
    expect(press("n", { target: document.createElement("textarea") })).toBeNull()
    expect(press("n", { repeat: true })).toBeNull()
    expect(press("n", { isComposing: true })).toBeNull()
    expect(press("n", { defaultPrevented: true })).toBeNull()
    expect(press("Enter")).toBeNull()
  })

  it("checkbox e botão não contam como digitação; contenteditable conta", () => {
    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    expect(isTypingTarget(checkbox)).toBe(false)
    expect(isTypingTarget(document.createElement("button"))).toBe(false)
    const editable = document.createElement("div")
    editable.setAttribute("contenteditable", "true")
    document.body.append(editable)
    expect(isTypingTarget(editable)).toBe(true)
    editable.remove()
  })
})
