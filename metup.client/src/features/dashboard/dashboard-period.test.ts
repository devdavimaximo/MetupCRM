import { beforeEach, describe, expect, it } from "vitest"

import {
  DEFAULT_PERIOD,
  MAX_PERIOD_DAYS,
  isPresetId,
  periodLabel,
  periodShortLabel,
  periodUrlPatch,
  readInitialPeriod,
  resolvePeriod,
  storePeriod,
  type DashboardPeriod,
} from "./dashboard-period"

const TODAY = "2026-09-15"

/** O que `readUrlState()` entrega ao dashboard, sem nada preenchido. */
const noUrl = { dashboardPeriod: "", dashboardFrom: "", dashboardTo: "" }

beforeEach(() => localStorage.clear())

describe("resolvePeriod", () => {
  it("atalhos de janela móvel viram dias — o servidor ancora em 'hoje'", () => {
    expect(resolvePeriod({ kind: "preset", preset: "hoje" }, TODAY)).toEqual({ days: 1 })
    expect(resolvePeriod({ kind: "preset", preset: "7d" }, TODAY)).toEqual({ days: 7 })
    expect(resolvePeriod({ kind: "preset", preset: "30d" }, TODAY)).toEqual({ days: 30 })
    expect(resolvePeriod({ kind: "preset", preset: "3m" }, TODAY)).toEqual({ days: 90 })
    expect(resolvePeriod({ kind: "preset", preset: "6m" }, TODAY)).toEqual({ days: 180 })
  })

  it("mês atual vai do dia 1 até hoje", () => {
    expect(resolvePeriod({ kind: "preset", preset: "mes-atual" }, TODAY)).toEqual({ from: "2026-09-01", to: "2026-09-15" })
  })

  it("mês anterior é o mês inteiro, não os últimos 30 dias", () => {
    expect(resolvePeriod({ kind: "preset", preset: "mes-anterior" }, TODAY)).toEqual({ from: "2026-08-01", to: "2026-08-31" })
  })

  it("mês anterior respeita fevereiro", () => {
    expect(resolvePeriod({ kind: "preset", preset: "mes-anterior" }, "2026-03-10")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    })
  })

  it("intervalo manual passa direto", () => {
    expect(resolvePeriod({ kind: "custom", from: "2026-01-01", to: "2026-01-31" }, TODAY)).toEqual({
      from: "2026-01-01",
      to: "2026-01-31",
    })
  })
})

describe("rótulos", () => {
  it("atalho usa o nome; intervalo manual usa as datas", () => {
    expect(periodLabel({ kind: "preset", preset: "30d" })).toBe("Últimos 30 dias")
    expect(periodLabel({ kind: "custom", from: "2026-08-16", to: "2026-09-15" })).toBe("16 ago – 15 set 2026")
  })

  it("o rótulo curto cabe no meio de uma frase", () => {
    expect(periodShortLabel({ kind: "preset", preset: "30d" })).toBe("30 dias")
    expect(periodShortLabel({ kind: "preset", preset: "mes-anterior" })).toBe("mês anterior")
    expect(periodShortLabel({ kind: "custom", from: "2026-08-16", to: "2026-09-15" })).toBe("período")
  })
})

describe("isPresetId", () => {
  it("só reconhece atalho existente", () => {
    expect(isPresetId("30d")).toBe(true)
    expect(isPresetId("mes-anterior")).toBe(true)
    expect(isPresetId("30")).toBe(false)
    expect(isPresetId(null)).toBe(false)
  })
})

describe("readInitialPeriod", () => {
  it("sem URL nem preferência, são 30 dias", () => {
    expect(readInitialPeriod(noUrl)).toEqual(DEFAULT_PERIOD)
  })

  it("a URL vence a preferência salva (o link compartilhado manda)", () => {
    localStorage.setItem("metup.dashboard.period", "7d")
    expect(readInitialPeriod({ ...noUrl, dashboardPeriod: "3m" })).toEqual({ kind: "preset", preset: "3m" })
  })

  it("o intervalo manual da URL vence o atalho da URL", () => {
    expect(readInitialPeriod({ dashboardPeriod: "7d", dashboardFrom: "2026-01-01", dashboardTo: "2026-01-31" })).toEqual({
      kind: "custom",
      from: "2026-01-01",
      to: "2026-01-31",
    })
  })

  it("intervalo invertido, incompleto ou malformado cai no padrão", () => {
    expect(readInitialPeriod({ ...noUrl, dashboardFrom: "2026-02-01", dashboardTo: "2026-01-01" })).toEqual(DEFAULT_PERIOD)
    expect(readInitialPeriod({ ...noUrl, dashboardFrom: "2026-01-01", dashboardTo: "" })).toEqual(DEFAULT_PERIOD)
    expect(readInitialPeriod({ ...noUrl, dashboardFrom: "ontem", dashboardTo: "hoje" })).toEqual(DEFAULT_PERIOD)
  })

  it("intervalo maior que o teto do validador cai no padrão", () => {
    expect(readInitialPeriod({ ...noUrl, dashboardFrom: "2025-01-01", dashboardTo: "2026-12-31" })).toEqual(DEFAULT_PERIOD)
    // E exatamente no teto continua valendo.
    expect(readInitialPeriod({ ...noUrl, dashboardFrom: "2026-01-01", dashboardTo: "2026-12-31" })).toEqual({
      kind: "custom",
      from: "2026-01-01",
      to: "2026-12-31",
    })
    expect(MAX_PERIOD_DAYS).toBe(366)
  })

  it("lembra a última escolha salva no navegador", () => {
    localStorage.setItem("metup.dashboard.period", "mes-anterior")
    expect(readInitialPeriod(noUrl)).toEqual({ kind: "preset", preset: "mes-anterior" })
  })

  it("converte o valor antigo do <select> de quem já usava o dashboard", () => {
    localStorage.setItem("metup.dashboard.period", "90")
    expect(readInitialPeriod(noUrl)).toEqual({ kind: "preset", preset: "3m" })
  })

  it("valor salvo irreconhecível cai no padrão", () => {
    localStorage.setItem("metup.dashboard.period", "sempre")
    expect(readInitialPeriod(noUrl)).toEqual(DEFAULT_PERIOD)
  })
})

describe("storePeriod", () => {
  it("guarda o atalho", () => {
    storePeriod({ kind: "preset", preset: "6m" })
    expect(localStorage.getItem("metup.dashboard.period")).toBe("6m")
  })

  it("não guarda intervalo manual: é contexto de um link, não preferência", () => {
    storePeriod({ kind: "preset", preset: "6m" })
    storePeriod({ kind: "custom", from: "2026-01-01", to: "2026-01-31" })
    expect(localStorage.getItem("metup.dashboard.period")).toBe("6m")
  })
})

describe("periodUrlPatch", () => {
  it("atalho limpa as datas da URL", () => {
    expect(periodUrlPatch({ kind: "preset", preset: "7d" })).toEqual({
      dashboardPeriod: "7d",
      dashboardFrom: "",
      dashboardTo: "",
    })
  })

  it("intervalo manual limpa o atalho da URL", () => {
    expect(periodUrlPatch({ kind: "custom", from: "2026-01-01", to: "2026-01-31" })).toEqual({
      dashboardPeriod: "",
      dashboardFrom: "2026-01-01",
      dashboardTo: "2026-01-31",
    })
  })

  it("o que sai no patch volta igual pela URL (ida e volta)", () => {
    const periods: DashboardPeriod[] = [
      { kind: "preset", preset: "mes-atual" },
      { kind: "custom", from: "2026-03-01", to: "2026-03-31" },
    ]
    for (const period of periods) {
      expect(readInitialPeriod(periodUrlPatch(period))).toEqual(period)
    }
  })
})
