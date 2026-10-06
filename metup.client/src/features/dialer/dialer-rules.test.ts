import { describe, expect, it } from "vitest"

import { businessDaysFrom, outcomeKey, OUTCOME_KEYS, sessionOrder, suggestedFollowUp, suggestedStage } from "./dialer-rules"

describe("dialer-rules", () => {
  it("atalhos 1–7 seguem a ordem dos chips de desfecho", () => {
    expect(OUTCOME_KEYS["1"]).toBe("Atendeu")
    expect(OUTCOME_KEYS["7"]).toBe("ReuniaoAgendada")
    expect(outcomeKey("NaoAtendeu")).toBe("2")
  })

  it("próximo dia útil pula o fim de semana", () => {
    // Sexta, 16/10/2026 15:00 → segunda 19/10 às 10:00.
    const friday = new Date(2026, 9, 16, 15, 0)
    expect(businessDaysFrom(friday, 1)).toEqual(new Date(2026, 9, 19, 10, 0))
    expect(businessDaysFrom(friday, 2)).toEqual(new Date(2026, 9, 20, 10, 0))
  })

  it("sugere tentar de novo, mandar WhatsApp ou encerrar conforme o desfecho", () => {
    const now = new Date(2026, 9, 14, 11, 0)
    expect(suggestedFollowUp("NaoAtendeu", now)).toEqual({ kind: "next", type: "Call", due: new Date(2026, 9, 15, 10, 0) })
    expect(suggestedFollowUp("Atendeu", now)).toMatchObject({ kind: "next", type: "WhatsApp" })
    expect(suggestedFollowUp("ReuniaoAgendada", now)).toMatchObject({ kind: "next", type: "Meeting" })
    expect(suggestedFollowUp("SemInteresse", now)).toEqual({ kind: "lost", reason: "SemInteresse", note: null })
    expect(suggestedFollowUp("NumeroInvalido", now)).toEqual({ kind: "lost", reason: "Outro", note: "Número inválido" })
  })

  it("estágio só anda para frente", () => {
    expect(suggestedStage("Prospect", "NaoAtendeu")).toBe("PrimeiroContato")
    expect(suggestedStage("Prospect", "ReuniaoAgendada")).toBe("Reuniao")
    expect(suggestedStage("PrimeiroContato", "NaoAtendeu")).toBeNull()
    expect(suggestedStage("Proposta", "Interessado")).toBeNull()
  })

  it("pulados vão para o fim, na ordem em que foram pulados, e concluídos saem", () => {
    const items = ["a", "b", "c", "d"].map((dealId) => ({ dealId }))
    const order = sessionOrder(items, ["b", "a"], new Set(["c"]))
    expect(order.map((i) => i.dealId)).toEqual(["d", "b", "a"])
  })
})
