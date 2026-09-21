import { describe, expect, it } from "vitest"

import { applyRemoteCard, cardMatchesFilter, DeferredEvents, dropCard, RecentOwnActions, type BoardRealtimeFilter } from "./board-realtime"
import { columnsFromBoard } from "./board-state"
import { board, card, column } from "./board-test-fixtures"

const ALL: BoardRealtimeFilter = { ownerUserId: null, sources: [], segments: [], search: "", stalledOnly: false, from: "2026-08-21", to: "2026-09-19" }

const quadro = () =>
  columnsFromBoard(
    board({
      Qualificacao: column("Qualificacao", [card({ id: "a", value: 1000 }), card({ id: "b", value: 500, companyName: "Ótica Lumen" })]),
      Reuniao: column("Reuniao", [card({ id: "c", stage: "Reuniao", value: 2000 })], { count: 7, total: 30_000, hasMore: true }),
    })
  )

describe("recorte do quadro", () => {
  it("responsável, origem, segmento e parados", () => {
    expect(cardMatchesFilter(card(), ALL)).toBe(true)
    expect(cardMatchesFilter(card(), { ...ALL, ownerUserId: "outro" })).toBe(false)
    expect(cardMatchesFilter(card(), { ...ALL, sources: ["MetaAds"] })).toBe(false)
    expect(cardMatchesFilter(card({ companySegment: null }), { ...ALL, segments: ["Varejo"] })).toBe(false)
    expect(cardMatchesFilter(card({ isStalled: false }), { ...ALL, stalledOnly: true })).toBe(false)
  })

  it("busca como o servidor: sem acento e sem caixa, em empresa e contato", () => {
    expect(cardMatchesFilter(card({ companyName: "Ótica Lumen" }), { ...ALL, search: "otica" })).toBe(true)
    expect(cardMatchesFilter(card({ contactName: "José Araújo" }), { ...ALL, search: "ARAUJO" })).toBe(true)
    expect(cardMatchesFilter(card(), { ...ALL, search: "padaria" })).toBe(false)
  })

  it("fechado só entra se o fechamento cai no período", () => {
    const won = card({ status: "Ganho", stage: "Ganho", closedAt: "2026-09-10T15:00:00Z" })
    expect(cardMatchesFilter(won, ALL)).toBe(true)
    expect(cardMatchesFilter({ ...won, closedAt: "2026-07-01T15:00:00Z" }, ALL)).toBe(false)
    expect(cardMatchesFilter(won, { ...ALL, stalledOnly: true })).toBe(false)
  })
})

describe("aplicar o cartão do servidor", () => {
  it("na mesma coluna, troca no lugar e acerta o total pela diferença", () => {
    const result = applyRemoteCard(quadro(), card({ id: "b", value: 800, companyName: "Ótica Lumen" }), true)
    expect(result.change).toBe("updated")
    expect(result.touched).toEqual([])
    expect(result.columns.Qualificacao.items.map((c) => c.id)).toEqual(["a", "b"])
    expect(result.columns.Qualificacao.total).toBe(1800)
  })

  it("mudou de etapa: sai de uma coluna e entra no topo da outra, com os números das duas", () => {
    const result = applyRemoteCard(quadro(), card({ id: "a", stage: "Reuniao", value: 1000 }), true)
    expect(result.change).toBe("moved")
    expect(result.touched).toEqual(["Qualificacao", "Reuniao"])
    expect(result.columns.Qualificacao).toMatchObject({ count: 1, total: 500 })
    expect(result.columns.Reuniao).toMatchObject({ count: 8, total: 31_000 })
    expect(result.columns.Reuniao.items[0].id).toBe("a")
  })

  it("fechou no período: vai para Ganhos", () => {
    const result = applyRemoteCard(quadro(), card({ id: "a", stage: "Ganho", status: "Ganho", closedAt: "2026-09-18T12:00:00Z" }), true)
    expect(result.change).toBe("moved")
    expect(result.columns.won.items.map((c) => c.id)).toEqual(["a"])
    expect(result.columns.won.count).toBe(1)
  })

  it("saiu do recorte: sai do quadro", () => {
    const result = applyRemoteCard(quadro(), card({ id: "a", ownerUserId: "outro" }), false)
    expect(result.change).toBe("removed")
    expect(result.columns.Qualificacao).toMatchObject({ count: 1, total: 500 })
  })

  it("entrou no recorte sem estar na tela: topo da coluna, contando na coluna inteira", () => {
    const result = applyRemoteCard(quadro(), card({ id: "novo", stage: "Reuniao", value: 3000 }), true)
    expect(result.change).toBe("inserted")
    expect(result.touched).toEqual(["Reuniao"])
    expect(result.columns.Reuniao).toMatchObject({ count: 8, total: 33_000 })
    expect(result.columns.Reuniao.items[0].id).toBe("novo")
  })

  it("fora do recorte e fora da tela: nada muda", () => {
    const columns = quadro()
    const result = applyRemoteCard(columns, card({ id: "outro" }), false)
    expect(result.change).toBe("none")
    expect(result.columns).toBe(columns)
  })

  it("negócio que sumiu (404 ao reler) sai do quadro", () => {
    expect(dropCard(quadro(), "c").columns.Reuniao.count).toBe(6)
    expect(dropCard(quadro(), "x").change).toBe("none")
  })
})

describe("ações próprias", () => {
  it("o eco da própria ação é reconhecido só dentro da janela", () => {
    const own = new RecentOwnActions(1_000)
    own.mark("a", 0)
    expect(own.has("a", 500)).toBe(true)
    expect(own.has("a", 1_500)).toBe(false)
    expect(own.has("b", 0)).toBe(false)
  })
})

describe("fila durante o arrasto", () => {
  it("guarda o negócio preso e solta quando a interação termina, uma leitura por negócio", () => {
    const queue = new DeferredEvents()
    queue.defer("a")
    queue.defer("a")
    queue.defer("b")
    expect(queue.size).toBe(2)

    // "a" ainda está sendo arrastado: só "b" sai.
    expect(queue.take((id) => id !== "a", true)).toEqual({ ids: ["b"], board: false })
    expect(queue.take(() => true, true)).toEqual({ ids: ["a"], board: false })
    expect(queue.size).toBe(0)
  })

  it("a revalidação do quadro inteiro espera o fim do arrasto", () => {
    const queue = new DeferredEvents()
    queue.defer(null)
    expect(queue.take(() => true, false)).toEqual({ ids: [], board: false })
    expect(queue.take(() => true, true)).toEqual({ ids: [], board: true })
    expect(queue.size).toBe(0)
  })
})
