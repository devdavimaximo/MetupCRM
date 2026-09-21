import { describe, expect, it } from "vitest"

import type { DealBoardCard } from "./api"
import { COLUMN_CARD_CAP, canLoadMoreInColumn, columnsFromBoard, removeCard, replaceCard } from "./board-state"

const card = (patch: Partial<DealBoardCard> = {}): DealBoardCard => ({
  id: "d-1",
  companyId: "c-1",
  companyName: "Tech Solutions",
  companySegment: "Tecnologia",
  contactName: null,
  stage: "Qualificacao",
  status: "Aberto",
  source: "Sdr",
  ownerUserId: "u-1",
  ownerUserName: "Davi Maximo",
  value: 12_000,
  valueIsEstimated: false,
  stageEnteredAt: "2026-09-10T12:00:00Z",
  daysInStage: 5,
  isStalled: false,
  lastActivityAt: null,
  nextTask: null,
  expectedCloseDate: null,
  closedAt: null,
  lostReason: null,
  ...patch,
})

const emptyColumn = { count: 0, total: 0, totalHasEstimate: false, page: 1, items: [], hasMore: false }

function boardWith(cards: DealBoardCard[]) {
  return columnsFromBoard({
    ownerUserId: null,
    periodStartLocal: "2026-08-17",
    periodEndLocal: "2026-09-15",
    sort: "Stalled",
    columns: [
      { stage: "Prospect", ...emptyColumn },
      { stage: "PrimeiroContato", ...emptyColumn },
      { stage: "ContatoRealizado", ...emptyColumn },
      {
        stage: "Qualificacao",
        count: cards.length,
        total: cards.reduce((sum, c) => sum + (c.value ?? 0), 0),
        totalHasEstimate: false,
        page: 1,
        items: cards,
        hasMore: false,
      },
      { stage: "Reuniao", ...emptyColumn },
      { stage: "Proposta", ...emptyColumn },
      { stage: "Negociacao", ...emptyColumn },
    ],
    closed: { won: { stage: "Ganho", ...emptyColumn }, lost: { stage: "Perdido", ...emptyColumn } },
  })
}

describe("reatribuição otimista", () => {
  it("troca o responsável no cartão sem mexer na contagem nem na soma da coluna", () => {
    const columns = boardWith([card()])
    const next = replaceCard(columns, { ...card(), ownerUserId: "u-2", ownerUserName: "Carla Closer" })
    const column = next.Qualificacao

    expect(column.items[0].ownerUserName).toBe("Carla Closer")
    expect([column.count, column.total]).toEqual([1, 12_000])
  })

  it("quando o novo dono sai do filtro, o cartão deixa o quadro e os números caem", () => {
    const columns = boardWith([card(), card({ id: "d-2", value: 3_000 })])
    const { columns: next } = removeCard(columns, card(), "Qualificacao")

    expect(next.Qualificacao.items.map((c) => c.id)).toEqual(["d-2"])
    expect([next.Qualificacao.count, next.Qualificacao.total]).toEqual([1, 3_000])
  })

  it("o cartão devolvido pelo servidor substitui o otimista, acertando o valor", () => {
    const columns = boardWith([card()])
    const next = replaceCard(columns, { ...card(), ownerUserId: "u-2", ownerUserName: "Carla Closer", value: 15_000 })

    expect(next.Qualificacao.total).toBe(15_000)
  })
})

describe("teto da coluna", () => {
  it("carrega mais até o teto e para nele", () => {
    expect(canLoadMoreInColumn(20, true)).toBe(true)
    expect(canLoadMoreInColumn(COLUMN_CARD_CAP - 1, true)).toBe(true)
    expect(canLoadMoreInColumn(COLUMN_CARD_CAP, true)).toBe(false)
    expect(canLoadMoreInColumn(COLUMN_CARD_CAP + 20, true)).toBe(false)
  })

  it("sem mais páginas no servidor, não carrega mesmo abaixo do teto", () => {
    expect(canLoadMoreInColumn(5, false)).toBe(false)
  })
})
