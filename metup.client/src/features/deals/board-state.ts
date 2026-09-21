import type { DealBoard, DealBoardCard, DealBoardClosedGroup, DealBoardColumn, DealStage } from "./api"
import { ACTIVE_STAGES } from "./stage-labels"

/**
 * Estado local do quadro e as contas otimistas. Nada aqui faz rede nem mexe em DOM: o hook
 * (`useDealBoard`) chama estas funções e o teste as exercita direto.
 *
 * Contagem e total vêm do servidor (a coluna inteira, não só o que está carregado). Ao mover um
 * cartão, os dois números são ajustados pelo próprio cartão. O "est." (há valor estimado na coluna)
 * nem sempre dá para recalcular: quando a coluna que perde um cartão estimado ainda tem páginas não
 * carregadas, ninguém aqui sabe se sobrou outro estimado — o resultado pede revalidação.
 */

/** Uma etapa ativa ou um dos grupos de Fechados. */
export type ColumnKey = DealStage | DealBoardClosedGroup

export type BoardColumnState = {
  key: ColumnKey
  count: number
  total: number
  totalHasEstimate: boolean
  items: DealBoardCard[]
  /** Última página carregada (a primeira vem com o quadro). */
  page: number
  hasMore: boolean
}

export type BoardColumns = Record<ColumnKey, BoardColumnState>

/** As oito posições do quadro, na ordem da tela: sete etapas e Fechados. */
export const BOARD_COLUMN_COUNT = ACTIVE_STAGES.length + 1

function toColumn(key: ColumnKey, column: DealBoardColumn): BoardColumnState {
  return {
    key,
    count: column.count,
    total: column.total,
    totalHasEstimate: column.totalHasEstimate,
    items: column.items,
    page: column.page,
    hasMore: column.hasMore,
  }
}

export function columnsFromBoard(board: DealBoard): BoardColumns {
  const columns = {} as BoardColumns
  for (const stage of ACTIVE_STAGES) {
    const column = board.columns.find((c) => c.stage === stage)
    columns[stage] = column
      ? toColumn(stage, column)
      : { key: stage, count: 0, total: 0, totalHasEstimate: false, items: [], page: 1, hasMore: false }
  }
  columns.won = toColumn("won", board.closed.won)
  columns.lost = toColumn("lost", board.closed.lost)
  return columns
}

/** Onde o cartão mora no quadro: a etapa, se aberto; o grupo de Fechados, se não. */
export function columnKeyOf(card: Pick<DealBoardCard, "status" | "stage">): ColumnKey {
  if (card.status === "Ganho") return "won"
  if (card.status === "Perdido") return "lost"
  return card.stage
}

/**
 * Teto de cartões numa coluna do quadro: acima disso a rolagem infinita para e o rodapé leva à
 * lista lateral (item 16 da PL3). 100 é o ponto em que rolar deixa de ser mais rápido que buscar.
 */
export const COLUMN_CARD_CAP = 100

/** A coluna só carrega mais uma página se o servidor tem mais e o teto ainda não foi alcançado. */
export const canLoadMoreInColumn = (loaded: number, hasMore: boolean) => hasMore && loaded < COLUMN_CARD_CAP

const valueOf = (card: DealBoardCard) => card.value ?? 0

/** Evita "−0,00" e resto de ponto flutuante na soma de centavos. */
const roundCents = (value: number) => Math.round(value * 100) / 100

/**
 * O "est." da coluna depois de tirar um cartão: `true`/`false` quando dá para saber, `null` quando
 * não dá (o cartão era estimado e ainda há cartões não carregados).
 */
export function estimateAfterRemoval(column: BoardColumnState, removed: DealBoardCard): boolean | null {
  if (!removed.valueIsEstimated) return column.totalHasEstimate
  const rest = column.items.filter((c) => c.id !== removed.id)
  if (rest.some((c) => c.valueIsEstimated)) return true
  return column.hasMore ? null : false
}

export type TransferResult = {
  columns: BoardColumns
  /** Colunas cujo "est." não pôde ser recalculado: revalidar os números em silêncio. */
  revalidate: ColumnKey[]
}

/**
 * Tira `card` de `from` e põe `placed` em `to` (no topo, ou em `index`), ajustando contagem, total e
 * "est." das duas. É a base do movimento otimista, do rollback e da correção vinda de um 409.
 * Cartão que não está em `from` não mexe em nada.
 */
export function transferCard(
  columns: BoardColumns,
  card: DealBoardCard,
  from: ColumnKey,
  to: ColumnKey,
  placed: DealBoardCard = card,
  index = 0
): TransferResult {
  const source = columns[from]
  if (from === to || !source.items.some((c) => c.id === card.id)) return { columns, revalidate: [] }

  const target = columns[to]
  const sourceEstimate = estimateAfterRemoval(source, card)
  const targetItems = target.items.filter((c) => c.id !== placed.id)
  targetItems.splice(Math.max(0, Math.min(index, targetItems.length)), 0, placed)

  return {
    columns: {
      ...columns,
      [from]: {
        ...source,
        items: source.items.filter((c) => c.id !== card.id),
        count: Math.max(0, source.count - 1),
        total: roundCents(source.total - valueOf(card)),
        totalHasEstimate: sourceEstimate ?? source.totalHasEstimate,
      },
      [to]: {
        ...target,
        items: targetItems,
        count: target.count + 1,
        total: roundCents(target.total + valueOf(placed)),
        totalHasEstimate: target.totalHasEstimate || placed.valueIsEstimated,
      },
    },
    revalidate: sourceEstimate === null ? [from] : [],
  }
}

/** Cartão na etapa nova, como o otimista o mostra até o servidor responder. */
export function cardInStage(card: DealBoardCard, stage: DealStage, nowIso: string): DealBoardCard {
  return { ...card, stage, stageEnteredAt: nowIso, daysInStage: 0, isStalled: false }
}

/**
 * Movimento otimista de etapa: o cartão vai para o topo da coluna de destino. O rollback é o mesmo
 * movimento ao contrário devolvendo o cartão original à posição em que estava.
 */
export function moveCard(columns: BoardColumns, card: DealBoardCard, toStage: DealStage, nowIso: string): TransferResult {
  return transferCard(columns, card, columnKeyOf(card), toStage, cardInStage(card, toStage, nowIso))
}

export function rollbackMove(columns: BoardColumns, original: DealBoardCard, movedTo: ColumnKey, originalIndex: number): TransferResult {
  const moved = columns[movedTo].items.find((c) => c.id === original.id)
  if (!moved) return { columns, revalidate: [] }
  return transferCard(columns, moved, movedTo, columnKeyOf(original), original, originalIndex)
}

/** Troca o cartão local pelo que o servidor devolveu, na mesma coluna, e acerta o total pela diferença. */
export function replaceCard(columns: BoardColumns, card: DealBoardCard): BoardColumns {
  const key = columnKeyOf(card)
  const column = columns[key]
  const current = column.items.find((c) => c.id === card.id)
  if (!current) return columns
  return {
    ...columns,
    [key]: {
      ...column,
      items: column.items.map((c) => (c.id === card.id ? card : c)),
      total: roundCents(column.total - valueOf(current) + valueOf(card)),
      totalHasEstimate: column.totalHasEstimate || card.valueIsEstimated,
    },
  }
}

/** Tira o cartão do quadro (fechado fora do período, por exemplo). */
export function removeCard(columns: BoardColumns, card: DealBoardCard, from: ColumnKey): TransferResult {
  const source = columns[from]
  if (!source.items.some((c) => c.id === card.id)) return { columns, revalidate: [] }
  const estimate = estimateAfterRemoval(source, card)
  return {
    columns: {
      ...columns,
      [from]: {
        ...source,
        items: source.items.filter((c) => c.id !== card.id),
        count: Math.max(0, source.count - 1),
        total: roundCents(source.total - valueOf(card)),
        totalHasEstimate: estimate ?? source.totalHasEstimate,
      },
    },
    revalidate: estimate === null ? [from] : [],
  }
}

/** Página seguinte da coluna. Um cartão que já está na tela (movido para cá) não se repete. */
export function appendPage(columns: BoardColumns, key: ColumnKey, page: DealBoardColumn): BoardColumns {
  const column = columns[key]
  const known = new Set(column.items.map((c) => c.id))
  return {
    ...columns,
    [key]: {
      ...column,
      items: [...column.items, ...page.items.filter((c) => !known.has(c.id))],
      page: page.page,
      hasMore: page.hasMore,
      count: page.count,
      total: page.total,
      totalHasEstimate: page.totalHasEstimate,
    },
  }
}

/** Números da coluna vindos do servidor, sem trocar os cartões carregados. */
export function applyColumnNumbers(
  columns: BoardColumns,
  key: ColumnKey,
  numbers: Pick<DealBoardColumn, "count" | "total" | "totalHasEstimate">
): BoardColumns {
  const column = columns[key]
  return {
    ...columns,
    [key]: {
      ...column,
      count: numbers.count,
      total: numbers.total,
      totalHasEstimate: numbers.totalHasEstimate,
      hasMore: column.items.length < numbers.count,
    },
  }
}

/** Posição do cartão na coluna (para o rollback devolvê-lo ao mesmo lugar). */
export function indexInColumn(columns: BoardColumns, card: DealBoardCard) {
  return Math.max(0, columns[columnKeyOf(card)].items.findIndex((c) => c.id === card.id))
}
