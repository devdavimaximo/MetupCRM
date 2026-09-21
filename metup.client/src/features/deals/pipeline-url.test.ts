import { describe, expect, it } from "vitest"

import {
  decodeList,
  encodeList,
  parsePipelineUrl,
  resolvePipelinePeriod,
  serializePipelineUrl,
  type RawPipelineUrl,
} from "./pipeline-url"

const empty: RawPipelineUrl = {
  period: "",
  from: "",
  to: "",
  owner: "",
  search: "",
  sources: "",
  segments: "",
  sort: "",
  closed: "",
  stalled: "",
  months: "",
  legacySource: "",
}
const raw = (patch: Partial<RawPipelineUrl>) => ({ ...empty, ...patch })

describe("links antigos", () => {
  it("origem=MetaAds (antes da PL2) vira a lista de origens", () => {
    expect(parsePipelineUrl(raw({ legacySource: "MetaAds" }), true).sources).toEqual(["MetaAds"])
  })

  it("origem desconhecida é ignorada", () => {
    expect(parsePipelineUrl(raw({ legacySource: "Fax" }), true).sources).toEqual([])
  })

  it("a lista nova vence a chave antiga", () => {
    expect(parsePipelineUrl(raw({ sources: "Sdr,WhatsApp", legacySource: "MetaAds" }), true).sources).toEqual(["Sdr", "WhatsApp"])
  })

  it("responsavel=<id> segue valendo; todos = todos; vazio = meus", () => {
    expect(parsePipelineUrl(raw({ owner: "u-2" }), true).owner).toEqual({ kind: "user", userId: "u-2" })
    expect(parsePipelineUrl(raw({ owner: "todos" }), true).owner).toEqual({ kind: "all" })
    expect(parsePipelineUrl(raw({}), true).owner).toEqual({ kind: "mine" })
  })

  it("SDR sempre fica nos próprios negócios, mesmo com link de outro responsável", () => {
    expect(parsePipelineUrl(raw({ owner: "todos" }), false).owner).toEqual({ kind: "mine" })
  })

  it("ao gravar, a chave antiga sai da URL", () => {
    const state = parsePipelineUrl(raw({ legacySource: "MetaAds" }), true)
    expect(serializePipelineUrl(state)).toMatchObject({ source: "", pipelineSources: "MetaAds" })
  })
})

describe("ida e volta", () => {
  it("o que é gravado é lido igual", () => {
    const state = parsePipelineUrl(
      raw({ period: "trimestre", owner: "todos", search: "tech", sources: "Sdr", segments: encodeList(["Varejo, atacado", "Saúde"]), sort: "valor", closed: "perdidos" }),
      true
    )
    const url = serializePipelineUrl(state)
    const back = parsePipelineUrl(
      raw({
        period: url.pipelinePeriod,
        from: url.pipelineFrom,
        to: url.pipelineTo,
        owner: url.ownerUserId,
        search: url.pipelineSearch,
        sources: url.pipelineSources,
        segments: url.pipelineSegments,
        sort: url.pipelineSort,
        closed: url.pipelineClosed,
      }),
      true
    )
    expect(back).toEqual(state)
    expect(back.segments).toEqual(["Varejo, atacado", "Saúde"])
    expect(back.sort).toBe("ValueDesc")
    expect(back.closedTab).toBe("lost")
  })

  it("o padrão não suja a URL", () => {
    const url = serializePipelineUrl(parsePipelineUrl(empty, true))
    expect(url).toMatchObject({ pipelinePeriod: "", pipelineSort: "", pipelineClosed: "", ownerUserId: "", pipelineSources: "" })
  })

  it("intervalo inválido ou longo demais volta para o padrão", () => {
    expect(parsePipelineUrl(raw({ from: "2026-09-10", to: "2026-09-01" }), true).period).toEqual({ kind: "preset", preset: "30d" })
    expect(parsePipelineUrl(raw({ from: "2024-01-01", to: "2026-01-01" }), true).period).toEqual({ kind: "preset", preset: "30d" })
    expect(parsePipelineUrl(raw({ from: "2026-09-01", to: "2026-09-10" }), true).period).toEqual({ kind: "custom", from: "2026-09-01", to: "2026-09-10" })
  })

  it("lista com item malformado não quebra", () => {
    expect(decodeList("Sdr,%E0%A4%A,,WhatsApp")).toEqual(["Sdr", "WhatsApp"])
  })
})

describe("atalhos de período", () => {
  const today = "2026-09-19"
  it.each([
    ["mes-atual", { from: "2026-09-01", to: today }],
    ["30d", { from: "2026-08-21", to: today }],
    ["mes-anterior", { from: "2026-08-01", to: "2026-08-31" }],
    ["trimestre", { from: "2026-07-01", to: today }],
  ] as const)("%s", (preset, range) => {
    expect(resolvePipelinePeriod({ kind: "preset", preset }, today)).toEqual(range)
  })
})
