import { describe, expect, it } from "vitest"

import { readHiddenKpis, writeHiddenKpis } from "./hidden-kpis"

/** Um `localStorage` de mentira, com a opção de quebrar como um navegador em aba anônima. */
function fakeStorage(options: { failing?: boolean; initial?: string } = {}): Storage {
  const map = new Map<string, string>()
  if (options.initial !== undefined) map.set("metup.pipeline.hiddenKpis", options.initial)
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (key: string) => {
      if (options.failing) throw new Error("storage bloqueado")
      return map.get(key) ?? null
    },
    setItem: (key: string, value: string) => {
      if (options.failing) throw new Error("storage bloqueado")
      map.set(key, value)
    },
    removeItem: (key: string) => void map.delete(key),
  }
}

describe("KPIs ocultos", () => {
  it("guarda e lê a escolha do usuário", () => {
    const storage = fakeStorage()
    writeHiddenKpis(["averageTicket", "forecastRevenue"], storage)
    expect(readHiddenKpis(storage)).toEqual(["forecastRevenue", "averageTicket"])
  })

  it("restaurar volta a lista vazia", () => {
    const storage = fakeStorage({ initial: JSON.stringify(["openDeals"]) })
    writeHiddenKpis([], storage)
    expect(readHiddenKpis(storage)).toEqual([])
  })

  it("com o armazenamento indisponível, a página funciona sem nada oculto", () => {
    const storage = fakeStorage({ failing: true })
    expect(readHiddenKpis(storage)).toEqual([])
    expect(() => writeHiddenKpis(["openDeals"], storage)).not.toThrow()
  })

  it("sem armazenamento nenhum (SSR, navegador sem storage) também não quebra", () => {
    expect(readHiddenKpis(undefined)).toEqual([])
    expect(() => writeHiddenKpis(["openDeals"], undefined)).not.toThrow()
  })

  it("valor corrompido ou desconhecido é ignorado", () => {
    expect(readHiddenKpis(fakeStorage({ initial: "não é json" }))).toEqual([])
    expect(readHiddenKpis(fakeStorage({ initial: JSON.stringify({ oculto: true }) }))).toEqual([])
    expect(readHiddenKpis(fakeStorage({ initial: JSON.stringify(["openDeals", "kpiQueNaoExiste"]) }))).toEqual(["openDeals"])
  })
})
