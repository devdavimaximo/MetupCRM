import { describe, expect, it } from "vitest"

import { boardAnnouncements, targetPosition } from "./board-announcements"

const from = { kind: "stage", stage: "Qualificacao" } as const

describe("anúncios do teclado", () => {
  it("pegar diz o negócio, a coluna e a posição entre as oito", () => {
    expect(boardAnnouncements.pickup("Tech Solutions", from)).toBe("Negócio Tech Solutions pego. Coluna Qualificação, 4 de 8.")
  })

  it("passar por uma coluna diz onde está", () => {
    expect(boardAnnouncements.over({ kind: "stage", stage: "Negociacao" })).toBe("Coluna Negociação, 7 de 8.")
    expect(boardAnnouncements.over(null)).toBe("Fora das colunas.")
  })

  it("as zonas de Fechados avisam que soltar pede confirmação", () => {
    expect(boardAnnouncements.over({ kind: "close", won: true })).toBe(
      "Fechados, zona Ganho, 8 de 8. Soltar abre a confirmação do fechamento."
    )
  })

  it("soltar em outra coluna, na mesma, fora ou em Fechados", () => {
    expect(boardAnnouncements.drop("Tech Solutions", from, { kind: "stage", stage: "Reuniao" })).toBe("Negócio Tech Solutions movido para Reunião.")
    expect(boardAnnouncements.drop("Tech Solutions", from, from)).toBe("Negócio Tech Solutions solto na mesma coluna. Nada mudou.")
    expect(boardAnnouncements.drop("Tech Solutions", from, null)).toBe("Negócio Tech Solutions solto na mesma coluna. Nada mudou.")
    expect(boardAnnouncements.drop("Tech Solutions", from, { kind: "close", won: false })).toBe(
      "Negócio Tech Solutions solto em Perdido. Confirme o fechamento."
    )
  })

  it("Esc cancela e diz onde o negócio ficou", () => {
    expect(boardAnnouncements.cancel("Tech Solutions", from)).toBe("Movimento cancelado. Negócio Tech Solutions continua na Coluna Qualificação.")
  })

  it("posições: Prospect é 1, Negociação 7, Fechados 8", () => {
    expect(targetPosition({ kind: "stage", stage: "Prospect" })).toBe(1)
    expect(targetPosition({ kind: "stage", stage: "Negociacao" })).toBe(7)
    expect(targetPosition({ kind: "close", won: false })).toBe(8)
  })
})
