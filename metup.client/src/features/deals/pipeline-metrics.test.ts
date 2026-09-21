import { describe, expect, it } from "vitest"

import {
  formatMoneyCompact,
  kpiDelta,
  kpiDisplay,
  passageSentence,
  rateDelta,
  riskSentence,
  volumeSentence,
} from "./pipeline-metrics"

describe("valor compacto", () => {
  it("usa mil, mi e bi, com as casas que cabem no cartão", () => {
    expect(formatMoneyCompact(2_860_000)).toBe("R$ 2,86 mi")
    expect(formatMoneyCompact(184_200)).toBe("R$ 184,2 mil")
    expect(formatMoneyCompact(1_500_000_000)).toBe("R$ 1,50 bi")
  })

  it("abaixo de mil mostra o valor inteiro, e o zero não vira 'mil'", () => {
    expect(formatMoneyCompact(940)).toBe("R$ 940")
    expect(formatMoneyCompact(0)).toBe("R$ 0")
  })

  it("negativo mantém o sinal", () => {
    expect(formatMoneyCompact(-12_000)).toBe("−R$ 12,0 mil")
  })

  it("o cartão mostra o compacto e guarda o valor inteiro no title", () => {
    expect(kpiDisplay("pipelineTotal", 2_860_000)).toEqual({ text: "R$ 2,86 mi", title: "R$ 2.860.000" })
    expect(kpiDisplay("openDeals", 42)).toEqual({ text: "42" })
    expect(kpiDisplay("conversionRate", 0.084)).toEqual({ text: "8,4%" })
    expect(kpiDisplay("averageTicket", null)).toEqual({ text: "—" })
  })
})

describe("variação dos KPIs", () => {
  it("sem base anterior não inventa percentual", () => {
    expect(kpiDelta(100, null)).toEqual({ kind: "no-base" })
    expect(kpiDelta(null, 100)).toEqual({ kind: "no-base" })
    expect(rateDelta(0.1, undefined)).toEqual({ kind: "no-base" })
  })

  it("anterior zerado é 'novo', não uma divisão por zero", () => {
    expect(kpiDelta(500, 0)).toEqual({ kind: "new" })
  })

  it("valores comparam em percentual e taxas em pontos percentuais", () => {
    expect(kpiDelta(120, 100)).toEqual({ kind: "change", direction: "up", label: "+20%" })
    expect(kpiDelta(80, 100)).toEqual({ kind: "change", direction: "down", label: "−20%" })
    expect(rateDelta(0.12, 0.1)).toEqual({ kind: "change", direction: "up", label: "+2 p.p." })
    expect(rateDelta(0.1, 0.1)).toEqual({ kind: "change", direction: "flat", label: "0 p.p." })
  })
})

describe("frases dos insights", () => {
  it("maior volume nomeia a etapa e a fatia das entradas", () => {
    expect(volumeSentence({ stage: "Qualificacao", entered: 18, totalEntered: 56, pctOfTotal: 0.321, tied: [] })).toBe(
      "Qualificação recebeu 18 negócios (32,1% das entradas)."
    )
  })

  it("empate nomeia todas as etapas empatadas", () => {
    expect(volumeSentence({ stage: "Reuniao", entered: 4, totalEntered: 16, pctOfTotal: 0.25, tied: ["Proposta"] })).toBe(
      "Reunião e Proposta empataram com 4 negócios cada (25% das entradas)."
    )
  })

  it("sem entradas na janela, diz isso em vez de mostrar zero", () => {
    expect(volumeSentence(null)).toBe("Nenhum negócio mudou de etapa nos últimos 30 dias.")
  })

  it("melhor passagem mostra a taxa e a amostra", () => {
    expect(
      passageSentence({ fromStage: "Qualificacao", toStage: "Reuniao", entered: 5, advanced: 4, rate: 0.8, tied: [] }, 5)
    ).toBe("De Qualificação para Reunião, 80% avançam (4 de 5).")
  })

  it("sem amostra mínima, explica a ausência", () => {
    expect(passageSentence(null, 5)).toBe("Ainda não há etapa com 5 entradas no período para comparar as passagens.")
  })

  it("riscos dizem o limite da organização, e zero é uma boa notícia", () => {
    expect(riskSentence({ count: 7, value: 84_000, stalledAfterDays: 7 })).toBe(
      "7 negócios parados há mais de 7 dias e somam R$ 84.000."
    )
    expect(riskSentence({ count: 0, value: 0, stalledAfterDays: 10 })).toBe(
      "Nenhum negócio parado há mais de 10 dias de Qualificação em diante."
    )
    expect(riskSentence({ count: 1, value: 0, stalledAfterDays: 7 })).toBe(
      "1 negócio parado há mais de 7 dias e está sem valor informado."
    )
  })
})
