import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api"
import { changeDealStageForBoard, closeDeal, getDealBoard, getDealBoardColumn, getPipelineEvolution, staleDealOf } from "./api"
import { LOST_REASONS, lostReasonLabels } from "./stage-labels"

const fetchMock = vi.fn()

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url: new URL(url), body: init.body ? JSON.parse(String(init.body)) : undefined }
}

beforeEach(() => {
  // Um Response novo por chamada: o corpo só pode ser lido uma vez.
  fetchMock.mockImplementation(() => Promise.resolve(new Response("{}", { status: 200 })))
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe("contrato do pipeline", () => {
  it("repete origens e segmentos na query e só manda o que foi pedido", async () => {
    await getDealBoard({ allOwners: true, sources: ["Sdr", "MetaAds"], segments: ["Varejo"], search: "  joão ", sort: "ValueDesc" })

    const { url } = lastCall()
    expect(url.pathname).toBe("/api/deals/board")
    expect(url.searchParams.getAll("sources")).toEqual(["Sdr", "MetaAds"])
    expect(url.searchParams.getAll("segments")).toEqual(["Varejo"])
    expect(url.searchParams.get("search")).toBe("joão")
    expect(url.searchParams.get("allOwners")).toBe("true")
    expect(url.searchParams.get("sort")).toBe("ValueDesc")
    expect(url.searchParams.has("from")).toBe(false)
    expect(url.searchParams.has("ownerUserId")).toBe(false)
  })

  it("carrega mais por etapa ou por grupo de fechados", async () => {
    await getDealBoardColumn({ stage: "Proposta" }, { page: 2, from: "2026-09-01", to: "2026-09-15" })
    expect(lastCall().url.search).toBe("?from=2026-09-01&to=2026-09-15&stage=Proposta&page=2")

    await getDealBoardColumn({ closed: "lost" }, { page: 1 })
    expect(lastCall().url.searchParams.get("closed")).toBe("lost")
    expect(lastCall().url.searchParams.has("stage")).toBe(false)

    await getPipelineEvolution({ months: 12 })
    expect(lastCall().url.search).toBe("?months=12")
  })

  it("manda a etapa esperada e o motivo da perda no corpo", async () => {
    await changeDealStageForBoard("d-1", "Proposta", { expectedFromStage: "Reuniao" })
    expect(lastCall().body).toEqual({ stage: "Proposta", expectedFromStage: "Reuniao" })

    await changeDealStageForBoard("d-1", "Proposta")
    expect(lastCall().body).toEqual({ stage: "Proposta", expectedFromStage: null })

    await closeDeal("d-1", false, null, "Preco", "  caro  ")
    expect(lastCall().body).toEqual({ won: false, closedAmount: null, lostReason: "Preco", lostNote: "caro" })

    await closeDeal("d-1", true, 1500)
    expect(lastCall().body).toEqual({ won: true, closedAmount: 1500, lostReason: null, lostNote: null })
  })

  it("lê a ficha atual só do 409", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ title: "Já saiu da etapa", current: { id: "d-1", stage: "Reuniao" } }), { status: 409 })
    )

    const error = await changeDealStageForBoard("d-1", "Proposta", { expectedFromStage: "Qualificacao" }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(staleDealOf(error)).toMatchObject({ id: "d-1", stage: "Reuniao" })
    expect(staleDealOf(new ApiError("x", 422))).toBeNull()
    expect(staleDealOf(new Error("x"))).toBeNull()
  })

  it("todo motivo de perda tem rótulo", () => {
    expect(LOST_REASONS).toEqual(["Preco", "SemInteresse", "Concorrente", "SemResposta", "Timing", "Outro"])
    expect(LOST_REASONS.map((r) => lostReasonLabels[r])).toEqual([
      "Preço",
      "Sem interesse",
      "Concorrente",
      "Sem resposta",
      "Timing",
      "Outro",
    ])
  })
})
