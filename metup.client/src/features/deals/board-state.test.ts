import { describe, expect, it } from "vitest"

import { board, card, column } from "./board-test-fixtures"
import {
  appendPage,
  applyColumnNumbers,
  columnKeyOf,
  columnsFromBoard,
  estimateAfterRemoval,
  indexInColumn,
  moveCard,
  removeCard,
  replaceCard,
  rollbackMove,
  transferCard,
} from "./board-state"
import { ACTIVE_STAGES } from "./stage-labels"

const NOW = "2026-09-19T15:00:00.000Z"

describe("montagem do quadro", () => {
  it("põe as sete etapas e os dois grupos de Fechados com os números do servidor", () => {
    const columns = columnsFromBoard(board({ Proposta: column("Proposta", [card({ stage: "Proposta" })], { count: 40, total: 90_000, hasMore: true }) }))
    expect(Object.keys(columns)).toEqual([...ACTIVE_STAGES, "won", "lost"])
    expect(columns.Proposta).toMatchObject({ count: 40, total: 90_000, hasMore: true, page: 1 })
  })

  it("aberto mora na etapa; fechado, no grupo", () => {
    expect(columnKeyOf(card())).toBe("Qualificacao")
    expect(columnKeyOf(card({ status: "Ganho", stage: "Ganho" }))).toBe("won")
    expect(columnKeyOf(card({ status: "Perdido", stage: "Perdido" }))).toBe("lost")
  })
})

describe("movimento otimista", () => {
  const a = card({ id: "a", value: 1000 })
  const b = card({ id: "b", value: 2500.5 })
  const start = () =>
    columnsFromBoard(
      board({
        Qualificacao: column("Qualificacao", [a, b], { count: 12, total: 30_000 }),
        Reuniao: column("Reuniao", [card({ id: "r", stage: "Reuniao" })], { count: 3, total: 5000 }),
      })
    )

  it("tira de uma coluna e põe no topo da outra, ajustando contagem e total das duas", () => {
    const { columns, revalidate } = moveCard(start(), b, "Reuniao", NOW)
    expect(columns.Qualificacao).toMatchObject({ count: 11, total: 27_499.5 })
    expect(columns.Qualificacao.items.map((c) => c.id)).toEqual(["a"])
    expect(columns.Reuniao).toMatchObject({ count: 4, total: 7500.5 })
    expect(columns.Reuniao.items.map((c) => c.id)).toEqual(["b", "r"])
    expect(revalidate).toEqual([])
  })

  it("o cartão movido entra na etapa agora: zero dias, sem selo de parado", () => {
    const moved = moveCard(start(), a, "Reuniao", NOW).columns.Reuniao.items[0]
    expect(moved).toMatchObject({ stage: "Reuniao", stageEnteredAt: NOW, daysInStage: 0, isStalled: false })
  })

  it("cartão sem valor muda a contagem e não mexe no total", () => {
    const columns = columnsFromBoard(board({ Qualificacao: column("Qualificacao", [card({ value: null })], { count: 1, total: 0 }) }))
    const next = moveCard(columns, card({ value: null }), "Proposta", NOW).columns
    expect(next.Qualificacao).toMatchObject({ count: 0, total: 0 })
    expect(next.Proposta).toMatchObject({ count: 1, total: 0 })
  })

  it("rollback devolve o cartão original à mesma posição e desfaz os números", () => {
    const initial = start()
    const index = indexInColumn(initial, b)
    const moved = moveCard(initial, b, "Reuniao", NOW).columns
    const { columns } = rollbackMove(moved, b, "Reuniao", index)

    expect(columns.Qualificacao.items).toEqual(initial.Qualificacao.items)
    expect(columns.Qualificacao).toMatchObject({ count: 12, total: 30_000 })
    expect(columns.Reuniao.items.map((c) => c.id)).toEqual(["r"])
    expect(columns.Reuniao).toMatchObject({ count: 3, total: 5000 })
  })

  it("rollback de um cartão que já saiu da coluna não faz nada", () => {
    const initial = start()
    expect(rollbackMove(initial, b, "Reuniao", 1).columns).toBe(initial)
  })

  it("mover para a própria coluna não muda nada", () => {
    const initial = start()
    expect(transferCard(initial, a, "Qualificacao", "Qualificacao").columns).toBe(initial)
  })

  it("a resposta do servidor troca o cartão e acerta o total pela diferença", () => {
    const moved = moveCard(start(), a, "Reuniao", NOW).columns
    const next = replaceCard(moved, card({ id: "a", stage: "Reuniao", value: 1200, daysInStage: 0, isStalled: false }))
    expect(next.Reuniao.total).toBe(6200)
    expect(next.Reuniao.items[0].value).toBe(1200)
  })
})

describe("est. da coluna", () => {
  const est = card({ id: "e", valueIsEstimated: true })
  const plain = card({ id: "p" })

  it("tirar um cartão não estimado mantém o que a coluna tinha", () => {
    const col = columnsFromBoard(board({ Qualificacao: column("Qualificacao", [est, plain]) })).Qualificacao
    expect(estimateAfterRemoval(col, plain)).toBe(true)
  })

  it("tirar o único estimado de uma coluna toda carregada zera o est.", () => {
    const col = columnsFromBoard(board({ Qualificacao: column("Qualificacao", [est, plain]) })).Qualificacao
    expect(estimateAfterRemoval(col, est)).toBe(false)
  })

  it("com páginas não carregadas não dá para saber: pede revalidação da coluna de origem", () => {
    const columns = columnsFromBoard(board({ Qualificacao: column("Qualificacao", [est, plain], { count: 30, hasMore: true }) }))
    const { columns: next, revalidate } = moveCard(columns, est, "Proposta", NOW)
    expect(revalidate).toEqual(["Qualificacao"])
    expect(next.Qualificacao.totalHasEstimate).toBe(true) // fica o que era até o servidor responder
    expect(next.Proposta.totalHasEstimate).toBe(true)
  })

  it("números vindos do servidor valem e recalculam o hasMore sem trocar os cartões", () => {
    const columns = columnsFromBoard(board({ Qualificacao: column("Qualificacao", [plain], { count: 30, hasMore: true }) }))
    const next = applyColumnNumbers(columns, "Qualificacao", { count: 1, total: 1000, totalHasEstimate: false })
    expect(next.Qualificacao).toMatchObject({ count: 1, hasMore: false, items: [plain] })
  })
})

describe("fechamento e páginas", () => {
  it("fechar leva o cartão para o grupo, somando no fechado", () => {
    const columns = columnsFromBoard(board({ Negociacao: column("Negociacao", [card({ stage: "Negociacao" })]) }))
    const closed = card({ stage: "Ganho", status: "Ganho", value: 1500, closedAt: NOW })
    const next = transferCard(columns, card({ stage: "Negociacao" }), "Negociacao", "won", closed).columns
    expect(next.won).toMatchObject({ count: 1, total: 1500 })
    expect(next.Negociacao).toMatchObject({ count: 0, total: 0 })
  })

  it("fechado fora do período sai do quadro", () => {
    const columns = columnsFromBoard(board({ Negociacao: column("Negociacao", [card({ stage: "Negociacao" })]) }))
    const next = removeCard(columns, card({ stage: "Negociacao" }), "Negociacao").columns
    expect(next.Negociacao).toMatchObject({ count: 0, total: 0, items: [] })
  })

  it("a página seguinte não repete o cartão que já foi movido para cá", () => {
    const columns = columnsFromBoard(board({ Reuniao: column("Reuniao", [card({ id: "x", stage: "Reuniao" })], { count: 3, hasMore: true }) }))
    const page = column("Reuniao", [card({ id: "x", stage: "Reuniao" }), card({ id: "y", stage: "Reuniao" })], { page: 2, count: 3, hasMore: false })
    const next = appendPage(columns, "Reuniao", page)
    expect(next.Reuniao.items.map((c) => c.id)).toEqual(["x", "y"])
    expect(next.Reuniao).toMatchObject({ page: 2, hasMore: false })
  })
})
