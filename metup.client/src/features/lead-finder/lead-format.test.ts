import { describe, expect, it } from "vitest"

import { formatRating, formatReviewCount, isLikelyMobile, isSearchActive, mapsHref, searchProgress, searchState, searchTitle, shortAddress, websiteLabel } from "./lead-format"

describe("searchState", () => {
  it("sem resposta vence o status: a automação não pegou a busca", () => {
    expect(searchState({ status: "Requested", isStalled: true })).toEqual({ label: "Sem resposta", tone: "warning" })
    expect(searchState({ status: "Running", isStalled: false })).toEqual({ label: "Buscando", tone: "active" })
    expect(searchState({ status: "Failed", isStalled: false }).tone).toBe("danger")
  })

  it("só pedida/andando e dentro do prazo conta como ativa", () => {
    expect(isSearchActive({ status: "Running", isStalled: false })).toBe(true)
    expect(isSearchActive({ status: "Running", isStalled: true })).toBe(false)
    expect(isSearchActive({ status: "Completed", isStalled: false })).toBe(false)
  })
})

describe("textos da busca", () => {
  it("junta nicho e região", () => {
    expect(searchTitle({ query: "clínicas odontológicas", location: "Curitiba, PR" })).toBe("clínicas odontológicas · Curitiba, PR")
    expect(searchTitle({ query: "academias", location: null })).toBe("academias")
  })

  it("separa encontrados de novos, no singular e no plural", () => {
    expect(searchProgress({ receivedCount: 0, newCount: 0, status: "Requested" })).toBe("Na fila da automação")
    expect(searchProgress({ receivedCount: 1, newCount: 1, status: "Running" })).toBe("1 encontrado · 1 novo")
    expect(searchProgress({ receivedCount: 48, newCount: 30, status: "Completed" })).toBe("48 encontrados · 30 novos")
  })
})

describe("campos do lead", () => {
  it("mostra só o domínio do site", () => {
    expect(websiteLabel("https://www.odontovida.com.br/contato")).toBe("odontovida.com.br")
    expect(websiteLabel("não é url")).toBe("não é url")
  })

  it("formata nota e volume de avaliações em pt-BR", () => {
    expect(formatRating(4.7)).toBe("4,7")
    expect(formatRating(5)).toBe("5,0")
    expect(formatReviewCount(312)).toBe("312")
    // O Intl separa número e unidade com espaço não separável.
    expect(formatReviewCount(1234).replace(/\s/g, " ")).toBe("1,2 mil")
  })

  it("usa o link da fonte ou monta uma busca no Maps", () => {
    expect(mapsHref({ mapsUrl: "https://maps.google.com/?cid=1", name: "X", address: null, city: null })).toBe("https://maps.google.com/?cid=1")
    expect(mapsHref({ mapsUrl: null, name: "Odonto Vida", address: "Rua A, 10", city: "Curitiba" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=Odonto%20Vida%2C%20Rua%20A%2C%2010"
    )
  })

  it("não repete a cidade que já está no endereço", () => {
    expect(shortAddress({ address: "Rua A, 10 - Centro, Curitiba - PR", city: "Curitiba", state: "PR" })).toBe("Rua A, 10 - Centro, Curitiba - PR")
    expect(shortAddress({ address: "Rua A, 10", city: "Curitiba", state: "PR" })).toBe("Rua A, 10 · Curitiba - PR")
    expect(shortAddress({ address: null, city: null, state: null })).toBeNull()
  })
})

describe("isLikelyMobile", () => {
  it("reconhece celular com ou sem DDI e recusa fixo", () => {
    expect(isLikelyMobile("(41) 99999-0001")).toBe(true)
    expect(isLikelyMobile("+55 41 99999-0001")).toBe(true)
    expect(isLikelyMobile("(41) 3333-4444")).toBe(false)
    expect(isLikelyMobile(null)).toBe(false)
  })
})
