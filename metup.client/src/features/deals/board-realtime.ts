import { toLocalDate } from "@/lib/local-date"
import type { DealBoardCard, DealSource } from "./api"
import { columnKeyOf, removeCard, replaceCard, transferCard, type BoardColumns, type ColumnKey, type TransferResult } from "./board-state"

/**
 * Tempo real do quadro (item 23), sem rede nem DOM: decide se um cartão que chegou do servidor
 * pertence ao recorte da tela e como ele entra no quadro. O hook busca o cartão (`/card`) e chama
 * estas funções; o teste as exercita direto.
 *
 * O hub só diz **qual** negócio mudou — nunca o que mudou nem quem mudou. Por isso a tela sempre
 * relê o cartão, e "não pulsar as próprias ações" é decidido no client (ver `RecentOwnActions`).
 */

/** O recorte que o quadro está mostrando, no formato que dá para conferir contra um cartão. */
export type BoardRealtimeFilter = {
  /** `null` = todos os responsáveis. */
  ownerUserId: string | null
  sources: DealSource[]
  segments: string[]
  search: string
  stalledOnly: boolean
  /** Período de Fechados (dia local, inclusivo). */
  from: string
  to: string
}

/** Como o servidor compara (unaccent + sem caixa): "Ótica" acha "otica". */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")

export function cardMatchesFilter(card: DealBoardCard, filter: BoardRealtimeFilter): boolean {
  if (filter.ownerUserId !== null && card.ownerUserId !== filter.ownerUserId) return false
  if (filter.sources.length > 0 && !filter.sources.includes(card.source)) return false
  if (filter.segments.length > 0 && (card.companySegment === null || !filter.segments.includes(card.companySegment))) return false

  const search = fold(filter.search.trim())
  if (search && !fold(card.companyName).includes(search) && !fold(card.contactName ?? "").includes(search)) return false

  if (card.status === "Aberto") return !filter.stalledOnly || card.isStalled
  // Fechados só aparecem no período (e o recorte de parados não os alcança: fechado nunca está parado).
  if (filter.stalledOnly || !card.closedAt) return false
  const closedDay = toLocalDate(new Date(card.closedAt))
  return closedDay >= filter.from && closedDay <= filter.to
}

/** Onde o cartão está hoje no quadro, se estiver. */
export function locateCard(columns: BoardColumns, id: string): { key: ColumnKey; card: DealBoardCard } | null {
  for (const [key, column] of Object.entries(columns) as [ColumnKey, BoardColumns[ColumnKey]][]) {
    const card = column.items.find((c) => c.id === id)
    if (card) return { key, card }
  }
  return null
}

export type RemoteChange = "updated" | "moved" | "inserted" | "removed" | "none"

export type RemoteResult = TransferResult & {
  change: RemoteChange
  /** Coluna que muda de forma (entra, sai ou troca cartão de posição) — o hook confere o cursor nela. */
  touched: ColumnKey[]
}

/**
 * Aplica o cartão lido do servidor. No lugar quando continua na mesma coluna; no topo da coluna
 * nova quando mudou de etapa ou fechou; fora do quadro quando saiu do recorte; e, quando entra no
 * recorte sem estar na tela, no topo da coluna com contagem e total ajustados.
 */
export function applyRemoteCard(columns: BoardColumns, card: DealBoardCard, matches: boolean): RemoteResult {
  const found = locateCard(columns, card.id)
  const target = columnKeyOf(card)

  if (!found) {
    if (!matches) return { columns, revalidate: [], change: "none", touched: [] }
    return { ...insertCard(columns, card, target), change: "inserted", touched: [target] }
  }

  if (!matches) return { ...removeCard(columns, found.card, found.key), change: "removed", touched: [found.key] }

  if (found.key === target) return { columns: replaceCard(columns, card), revalidate: [], change: "updated", touched: [] }

  return { ...transferCard(columns, found.card, found.key, target, card), change: "moved", touched: [found.key, target] }
}

/** Cartão que entrou no recorte e não estava na tela: topo da coluna, contando na coluna inteira. */
function insertCard(columns: BoardColumns, card: DealBoardCard, key: ColumnKey): TransferResult {
  const column = columns[key]
  return {
    columns: {
      ...columns,
      [key]: {
        ...column,
        items: [card, ...column.items],
        count: column.count + 1,
        total: Math.round((column.total + (card.value ?? 0)) * 100) / 100,
        totalHasEstimate: column.totalHasEstimate || card.valueIsEstimated,
      },
    },
    revalidate: [],
  }
}

/** Remoção por evento: o negócio não existe mais para esta tela (404 ao reler, por exemplo). */
export function dropCard(columns: BoardColumns, id: string): RemoteResult {
  const found = locateCard(columns, id)
  if (!found) return { columns, revalidate: [], change: "none", touched: [] }
  return { ...removeCard(columns, found.card, found.key), change: "removed", touched: [found.key] }
}

/**
 * Os negócios que o próprio usuário acabou de mexer. O hub não diz quem agiu, então o eco de uma
 * ação própria é reconhecido pelo id dentro de uma janela curta: a atualização otimista já está na
 * tela, e o eco não pulsa nem relê o cartão.
 */
export class RecentOwnActions {
  private readonly until = new Map<string, number>()
  private readonly windowMs: number

  constructor(windowMs = 10_000) {
    this.windowMs = windowMs
  }

  mark(id: string, now = Date.now()) {
    this.until.set(id, now + this.windowMs)
  }

  has(id: string, now = Date.now()) {
    const until = this.until.get(id)
    if (until === undefined) return false
    if (until < now) {
      this.until.delete(id)
      return false
    }
    return true
  }
}

/**
 * Eventos que não podem ser aplicados agora (cartão sendo arrastado, chamada em voo, cursor sobre
 * a coluna). Guarda só **qual** negócio: na hora de aplicar, o cartão é relido, então dois eventos
 * do mesmo negócio viram uma leitura só. `revalidate` (reconexão) vale pelo quadro inteiro.
 */
export class DeferredEvents {
  private readonly ids = new Set<string>()
  private board = false

  defer(id: string | null) {
    if (id === null) this.board = true
    else this.ids.add(id)
  }

  get size() {
    return this.ids.size + (this.board ? 1 : 0)
  }

  /** Tira da fila o que já pode ser aplicado; o resto continua esperando. */
  take(canApply: (id: string) => boolean, canReloadBoard: boolean): { ids: string[]; board: boolean } {
    const ready = [...this.ids].filter(canApply)
    ready.forEach((id) => this.ids.delete(id))
    const board = this.board && canReloadBoard
    if (board) this.board = false
    return { ids: ready, board }
  }
}
