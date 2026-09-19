import { useCallback, useEffect, useRef, useState } from "react"

import type { OwnerFilter } from "@/components/OwnerPicker"
import { toMessage } from "@/features/companies/form-errors"
import { useAsyncResource, useDebouncedValue } from "@/lib/hooks"
import { toLocalDate, todayLocal } from "@/lib/local-date"
import { useToasts } from "@/lib/toasts"
import { readUrlState, writeUrlState } from "@/lib/url-state"
import {
  changeDealStageForBoard,
  getDealBoard,
  getDealBoardColumn,
  staleDealOf,
  type Deal,
  type DealBoardCard,
  type DealBoardClosedGroup,
  type DealBoardSort,
  type DealSource,
  type DealStage,
} from "./api"
import {
  applyColumnNumbers,
  appendPage,
  columnKeyOf,
  columnsFromBoard,
  indexInColumn,
  moveCard,
  removeCard,
  replaceCard,
  rollbackMove,
  transferCard,
  type BoardColumns,
  type ColumnKey,
  type TransferResult,
} from "./board-state"
import {
  parsePipelineUrl,
  resolvePipelinePeriod,
  serializePipelineUrl,
  type PipelinePeriodChoice,
} from "./pipeline-url"
import { ACTIVE_STAGES, stageLabels } from "./stage-labels"

export type BoardFilters = {
  search: string
  sources: DealSource[]
  segments: string[]
}

const NO_FILTERS: BoardFilters = { search: "", sources: [], segments: [] }

export function activeBoardFilterCount(filters: BoardFilters) {
  return (filters.search.trim() ? 1 : 0) + filters.sources.length + filters.segments.length
}

/** Tempo do realce do cartão que voltou ao lugar (erro, 409 ou desfazer). */
const RETURN_HIGHLIGHT_MS = 900

const isActiveStage = (key: ColumnKey): key is DealStage => (ACTIVE_STAGES as string[]).includes(key)

function ownerParams(owner: OwnerFilter) {
  if (owner.kind === "all") return { allOwners: true }
  if (owner.kind === "user") return { ownerUserId: owner.userId }
  return {}
}

/**
 * O quadro do Pipeline: filtros (na URL), carga por coluna no servidor, "carregar mais" de uma coluna
 * por vez, recarga silenciosa (o quadro fica esmaecido, sem esqueleto) e as mudanças otimistas —
 * mover, desfazer, 409 e fechar.
 *
 * O estado das colunas vive num ref além do `useState`: cada operação lê o estado mais recente de
 * forma síncrona (um arrasto logo depois de outro não pode partir de um quadro velho).
 */
export function useDealBoard(canSeeOthers: boolean) {
  const [initial] = useState(() => {
    const url = readUrlState()
    return parsePipelineUrl(
      {
        period: url.pipelinePeriod,
        from: url.pipelineFrom,
        to: url.pipelineTo,
        owner: url.ownerUserId,
        search: url.pipelineSearch,
        sources: url.pipelineSources,
        segments: url.pipelineSegments,
        sort: url.pipelineSort,
        closed: url.pipelineClosed,
        legacySource: url.source,
      },
      canSeeOthers
    )
  })

  const [period, setPeriod] = useState<PipelinePeriodChoice>(initial.period)
  const [owner, setOwnerState] = useState<OwnerFilter>(initial.owner)
  const [filters, setFilters] = useState<BoardFilters>({ search: initial.search, sources: initial.sources, segments: initial.segments })
  const [sort, setSort] = useState<DealBoardSort>(initial.sort)
  const [closedTab, setClosedTab] = useState<DealBoardClosedGroup>(initial.closedTab)
  const [today] = useState(todayLocal)

  const search = useDebouncedValue(filters.search.trim(), 300)
  const range = resolvePipelinePeriod(period, today)
  const params = {
    ...ownerParams(canSeeOthers ? owner : { kind: "mine" }),
    sources: filters.sources,
    segments: filters.segments,
    search: search || undefined,
    from: range.from,
    to: range.to,
    sort,
  }
  const paramsKey = JSON.stringify(params)
  const paramsRef = useRef(params)
  useEffect(() => {
    paramsRef.current = params
  })

  const [columns, setColumnsState] = useState<BoardColumns | null>(null)
  const columnsRef = useRef<BoardColumns | null>(null)
  /** Geração do quadro: resposta de "carregar mais" de um quadro anterior é descartada. */
  const generation = useRef(0)
  const [loadingMore, setLoadingMore] = useState<Partial<Record<ColumnKey, boolean>>>({})
  const [loadMoreErrors, setLoadMoreErrors] = useState<Partial<Record<ColumnKey, string>>>({})
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set())
  const [returnedIds, setReturnedIds] = useState<ReadonlySet<string>>(() => new Set())
  const toasts = useToasts()

  const setColumns = useCallback((next: BoardColumns | null) => {
    columnsRef.current = next
    setColumnsState(next)
  }, [])

  const board = useAsyncResource((signal) => getDealBoard(params, signal), [paramsKey], {
    keepPreviousData: true,
    onSuccess: (data) => {
      generation.current++
      setColumns(columnsFromBoard(data))
      setLoadingMore({})
      setLoadMoreErrors({})
    },
  })

  // A URL é um sistema externo: o efeito só a sincroniza.
  useEffect(() => {
    writeUrlState(serializePipelineUrl({ period, owner, sort, closedTab, ...filters }))
  }, [period, owner, sort, closedTab, filters])

  const columnRef = (key: ColumnKey) => (isActiveStage(key) ? { stage: key } : { closed: key as DealBoardClosedGroup })

  /** Contagem, total e "est." da coluna direto do servidor, sem trocar os cartões na tela. */
  const revalidateNumbers = useCallback((key: ColumnKey) => {
    const gen = generation.current
    getDealBoardColumn(columnRef(key), { ...paramsRef.current, page: 1 })
      .then((page) => {
        if (gen !== generation.current || !columnsRef.current) return
        setColumns(applyColumnNumbers(columnsRef.current, key, page))
      })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setColumns])

  const mutate = useCallback(
    (change: (current: BoardColumns) => TransferResult) => {
      const current = columnsRef.current
      if (!current) return
      const result = change(current)
      setColumns(result.columns)
      result.revalidate.forEach(revalidateNumbers)
    },
    [revalidateNumbers, setColumns]
  )

  function setPending(id: string, on: boolean) {
    setPendingIds((ids) => {
      const next = new Set(ids)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function flagReturned(id: string) {
    setReturnedIds((ids) => new Set(ids).add(id))
    window.setTimeout(() => {
      setReturnedIds((ids) => {
        const next = new Set(ids)
        next.delete(id)
        return next
      })
    }, RETURN_HIGHLIGHT_MS)
  }

  const findCard = (id: string) => {
    const current = columnsRef.current
    if (!current) return null
    for (const column of Object.values(current)) {
      const card = column.items.find((c) => c.id === id)
      if (card) return card
    }
    return null
  }

  /**
   * Muda a etapa com otimismo: o cartão vai na hora, a chamada leva `expectedFromStage` e a resposta
   * (o cartão do servidor) substitui o local. Erro devolve o cartão; 409 o leva para a etapa real.
   * Desfazer é uma nova mudança de etapa — o histórico registra as duas.
   */
  async function moveDeal(card: DealBoardCard, toStage: DealStage, options: { isUndo?: boolean } = {}) {
    if (card.status !== "Aberto" || card.stage === toStage || pendingIds.has(card.id)) return
    const fromStage = card.stage
    const originalIndex = columnsRef.current ? indexInColumn(columnsRef.current, card) : 0

    mutate((current) => moveCard(current, card, toStage, new Date().toISOString()))
    setPending(card.id, true)

    try {
      const updated = await changeDealStageForBoard(card.id, toStage, { expectedFromStage: fromStage })
      mutate((current) => ({ columns: replaceCard(current, updated), revalidate: [] }))
      if (options.isUndo) {
        toasts.show({ message: `Movimento desfeito. ${card.companyName} voltou para ${stageLabels[toStage]}.` })
      } else {
        toasts.show({
          message: `Movido para ${stageLabels[toStage]}.`,
          action: { label: "Desfazer", onAction: () => undoMove(card.id, toStage, fromStage) },
        })
      }
    } catch (error) {
      mutate((current) => rollbackMove(current, card, toStage, originalIndex))
      const stale = staleDealOf(error)
      if (stale) applyStale(card, stale)
      else toasts.show({ tone: "danger", message: toMessage(error, "Não foi possível mover o negócio. Ele voltou para a coluna de origem.") })
      flagReturned(card.id)
    } finally {
      setPending(card.id, false)
    }
  }

  function undoMove(id: string, movedTo: DealStage, backTo: DealStage) {
    const card = findCard(id)
    if (!card || card.status !== "Aberto" || card.stage !== movedTo) {
      toasts.show({ tone: "danger", message: "Não dá para desfazer: o negócio já mudou de novo." })
      return
    }
    void moveDeal(card, backTo, { isUndo: true })
  }

  /** 409: outro usuário já moveu (ou fechou). O cartão vai para onde ele está de verdade. */
  function applyStale(card: DealBoardCard, current: Deal) {
    if (current.status === "Aberto") {
      if (current.stage !== card.stage) mutate((columns) => moveCard(columns, card, current.stage, new Date().toISOString()))
    } else {
      mutate((columns) => removeCard(columns, card, card.stage))
      revalidateNumbers(current.status === "Ganho" ? "won" : "lost")
    }
    toasts.show({ tone: "danger", message: `Outro usuário já moveu este negócio para ${stageLabels[current.stage]}.` })
  }

  /** Depois de confirmar o fechamento: o cartão vai para Ganhos/Perdidos se o fechamento cai no período. */
  function applyClosed(card: DealBoardCard, deal: Deal) {
    const group: DealBoardClosedGroup = deal.status === "Ganho" ? "won" : "lost"
    const closed: DealBoardCard = {
      ...card,
      stage: deal.stage,
      status: deal.status,
      value: deal.amount,
      valueIsEstimated: false,
      closedAt: deal.closedAt,
      lostReason: deal.lostReason,
      isStalled: false,
      nextTask: null,
    }
    const closedDay = deal.closedAt ? toLocalDate(new Date(deal.closedAt)) : null
    const inPeriod = closedDay !== null && closedDay >= range.from && closedDay <= range.to
    const outcome = group === "won" ? "ganho" : "perdido"

    if (inPeriod) {
      mutate((columns) => transferCard(columns, card, columnKeyOf(card), group, closed))
      setClosedTab(group)
      toasts.show({ message: `${card.companyName} marcado como ${outcome}.` })
    } else {
      mutate((columns) => removeCard(columns, card, columnKeyOf(card)))
      toasts.show({ message: `${card.companyName} marcado como ${outcome}. O fechamento fica fora do período escolhido, então ele saiu do quadro.` })
    }
  }

  const loadingKeys = useRef(new Set<ColumnKey>())

  /** Próxima página da coluna. Resolve `true` se ainda há mais depois dela. */
  async function loadMore(key: ColumnKey): Promise<boolean> {
    const column = columnsRef.current?.[key]
    if (!column?.hasMore || loadingKeys.current.has(key)) return false
    const gen = generation.current
    loadingKeys.current.add(key)
    setLoadingMore((state) => ({ ...state, [key]: true }))
    setLoadMoreErrors((state) => ({ ...state, [key]: undefined }))
    try {
      const page = await getDealBoardColumn(columnRef(key), { ...paramsRef.current, page: column.page + 1 })
      if (gen !== generation.current || !columnsRef.current) return false
      setColumns(appendPage(columnsRef.current, key, page))
      return page.hasMore
    } catch (error) {
      if (gen === generation.current) {
        setLoadMoreErrors((state) => ({ ...state, [key]: toMessage(error, "Não foi possível carregar mais negócios.") }))
      }
      return false
    } finally {
      loadingKeys.current.delete(key)
      if (gen === generation.current) setLoadingMore((state) => ({ ...state, [key]: false }))
    }
  }

  /** "Ver todos (N)": nesta onda, carrega o resto na própria coluna, página a página. */
  async function loadAll(key: ColumnKey) {
    // Teto de segurança: 50 páginas de 20 são 1.000 cartões numa coluna.
    for (let i = 0; i < 50; i++) {
      if (!(await loadMore(key))) return
    }
  }

  return {
    period,
    owner,
    filters,
    sort,
    closedTab,
    range,
    today,
    columns,
    board,
    isFirstLoad: board.isLoading && columns === null,
    isReloading: board.isLoading && columns !== null,
    loadingMore,
    loadMoreErrors,
    pendingIds,
    returnedIds,
    toasts,
    activeFilters: activeBoardFilterCount(filters),
    setPeriod,
    setOwner: setOwnerState,
    setFilters,
    clearFilters: () => setFilters(NO_FILTERS),
    setSort,
    setClosedTab,
    moveDeal,
    applyClosed,
    loadMore,
    loadAll,
    /** Depois de uma ação fora do quadro (drawer, novo negócio): recarrega sem esqueleto. */
    revalidate: () => board.reload({ silent: true }),
  }
}

export type DealBoardView = ReturnType<typeof useDealBoard>
