import { describe, expect, it } from "vitest"

import { formatAttachmentSize, formatResponseTime, telHref } from "./inbox-format"

describe("formatResponseTime", () => {
  it("sem dados suficientes quando não há par inbound→outbound ainda", () => {
    expect(formatResponseTime(null)).toBe("Sem dados suficientes")
  })

  it("só minutos quando dá menos de uma hora", () => {
    expect(formatResponseTime(45)).toBe("45min")
    expect(formatResponseTime(0.4)).toBe("0min")
  })

  it("horas e minutos combinados, sem minutos quando é hora cheia", () => {
    expect(formatResponseTime(138)).toBe("2h 18min")
    expect(formatResponseTime(120)).toBe("2h")
  })
})

describe("formatAttachmentSize", () => {
  it("null sem tamanho conhecido", () => {
    expect(formatAttachmentSize(null)).toBeNull()
  })

  it("bytes em KB arredondado sem casa decimal", () => {
    expect(formatAttachmentSize(850 * 1024)).toBe("850 KB")
  })

  it("acima de 1 MB usa vírgula e uma casa decimal", () => {
    expect(formatAttachmentSize(Math.round(2.4 * 1024 * 1024))).toBe("2,4 MB")
  })
})

describe("telHref", () => {
  it("mantém só dígitos e o + inicial", () => {
    expect(telHref("+55 (11) 98888-7777")).toBe("tel:+5511988887777")
  })
})
