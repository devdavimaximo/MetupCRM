import { useCallback, useEffect, useRef, useState } from "react"

import type { OwnerFilter } from "@/components/OwnerPicker"
import { toMessage } from "@/features/companies/form-errors"
import { useAsyncResource, useDebouncedValue } from "@/lib/hooks"
import { toLocalDate, todayLocal } from "@/lib/local-date"
import { useToasts } from "@/lib/toasts"
import { readUrlState, writeUrlState } from "@/lib/url-state"
import { listActivityFeed } from "@/features/dashboard/api"
import {
  changeDealStageForBoard,
  getDealBoard,
  getDealBoardCard,
  getDealBoardColumn,
  getPipelineEvolution,
  getPipelineInsights,
  getPipelineSummary,
  reassignDealForBoard,
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
  pipelinePeriodLabel,
  resolvePipelinePeriod,
  serializePipelineUrl,
  type EvolutionMonths,
  type PipelinePeriodChoice,
} from "./pipeline-url"
import type { BoardRealtimeFilter } from "./board-realtime"
import { useBoardRealtime } from "./useBoardRealtime"
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

/** Folga antes de recarregar KPIs, funil, insights e evolução — arrastos vêm em rajada. */
const METRICS_DEBOUNCE_MS = 800

/** Quantos eventos a faixa de Atividades Recentes mostra (item 19). */
export const ACTIVITY_COUNT = 5

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
export function useDealBoard(canSeeOthers: boolean, currentUserId: string) {
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
        stalled: url.pipelineStalled,
        months: url.pipelineMonths,
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
  const [stalledOnly, setStalledOnly] = useState(initial.stalledOnly)
  const [months, setMonths] = useState<EvolutionMonths>(initial.months)
  const [today] = useState(todayLocal)

  const search = useDebouncedValue(filters.search.trim(), 300)
  const range = resolvePipelinePeriod(period, today)
  const params = {
    ...ownerParams(canSeeOthers ? owner : { kind: "mine" }),
    sources: filters.sources,
    segments: filters.segments,
    search: search || undefined,
    stalledOnly: stalledOnly || undefined,
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
  const pendingRef = useRef<ReadonlySet<string>>(pendingIds)
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

  /**
   * Os números da tela (item 9, 10, 17, 18 e 19). Cada um é um recurso à parte: o quadro nunca
   * espera por eles, e um erro aqui não derruba o quadro. Os insights e o resumo seguem os mesmos
   * filtros; a evolução não leva período (ela tem os próprios meses) nem o filtro de parados.
   */
  const summaryParams = { ...params, sort: undefined }
  const summaryKey = JSON.stringify(summaryParams)
  const summary = useAsyncResource((signal) => getPipelineSummary(params, signal), [summaryKey], { keepPreviousData: true })
  const insights = useAsyncResource((signal) => getPipelineInsights(params, signal), [summaryKey], { keepPreviousData: true })
  const evolution = useAsyncResource(
    (signal) => getPipelineEvolution({ ...params, stalledOnly: undefined, months }, signal),
    [summaryKey, months],
    { keepPreviousData: true }
  )
  const activities = useAsyncResource(
    (signal) => listActivityFeed({ ownerUserId: params.ownerUserId, pageSize: ACTIVITY_COUNT }, signal),
    [params.ownerUserId ?? ""],
    { keepPreviousData: true }
  )

  // A URL é um sistema externo: o efeito só a sincroniza.
  useEffect(() => {
    writeUrlState(serializePipelineUrl({ period, owner, sort, closedTab, stalledOnly, months, ...filters }))
  }, [period, owner, sort, closedTab, stalledOnly, months, filters])

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

  /**
   * Os números da tela depois de mover ou fechar um cartão: em silêncio e com folga, porque um
   * arrasto costuma vir atrás do outro. Nunca mexe no quadro nem no cartão em voo.
   */
  const metricsTimer = useRef<number | undefined>(undefined)
  const revalidateMetrics = useCallback((delayMs = METRICS_DEBOUNCE_MS) => {
    window.clearTimeout(metricsTimer.current)
    metricsTimer.current = window.setTimeout(() => {
      summary.reload({ silent: true })
      insights.reload({ silent: true })
      evolution.reload({ silent: true })
      activities.reload({ silent: true })
    }, delayMs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => () => window.clearTimeout(metricsTimer.current), [])

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

  /** O recorte da tela, para o tempo real decidir se um cartão que mudou pertence a ele. */
  const filter: BoardRealtimeFilter = {
    ownerUserId: !canSeeOthers || owner.kind === "mine" ? currentUserId : owner.kind === "user" ? owner.userId : null,
    sources: filters.sources,
    segments: filters.segments,
    search,
    stalledOnly,
    from: range.from,
    to: range.to,
  }
  const filterRef = useRef(filter)
  useEffect(() => {
    filterRef.current = filter
  })

  const realtime = useBoardRealtime({
    columnsRef,
    generationRef: generation,
    pendingRef,
    filterRef,
    commit: (result) => mutate(() => result),
    reloadBoard: () => board.reload({ silent: true }),
    reloadMetrics: revalidateMetrics,
  })

  function setPending(id: string, on: boolean) {
    const next = new Set(pendingRef.current)
    if (on) next.add(id)
    else next.delete(id)
    pendingRef.current = next
    setPendingIds(next)
    if (!on) realtime.settled()
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
    if (card.status !== "Aberto" || card.stage === toStage || pendingRef.current.has(card.id)) return
    const fromStage = card.stage
    realtime.markOwn(card.id)
    const originalIndex = columnsRef.current ? indexInColumn(columnsRef.current, card) : 0

    mutate((current) => moveCard(current, card, toStage, new Date().toISOString()))
    setPending(card.id, true)

    try {
      const updated = await changeDealStageForBoard(card.id, toStage, { expectedFromStage: fromStage })
      mutate((current) => ({ columns: replaceCard(current, updated), revalidate: [] }))
      revalidateMetrics()
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
    realtime.markOwn(card.id)
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
    revalidateMetrics()

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

  /**
   * Troca o responsável (item 15). Otimista: o cartão muda na hora e o servidor devolve o cartão
   * atualizado. Se o novo dono sai do filtro de responsável, o cartão deixa o quadro.
   */
  async function reassignDeal(card: DealBoardCard, ownerUserId: string, ownerUserName: string) {
    if (card.status !== "Aberto" || card.ownerUserId === ownerUserId || pendingRef.current.has(card.id)) return
    const key = columnKeyOf(card)
    realtime.markOwn(card.id)

    mutate((current) => ({ columns: replaceCard(current, { ...card, ownerUserId, ownerUserName }), revalidate: [] }))
    setPending(card.id, true)

    try {
      const updated = await reassignDealForBoard(card.id, ownerUserId)
      const leavesFilter = owner.kind === "user" && owner.userId !== ownerUserId
      if (leavesFilter) {
        mutate((current) => removeCard(current, card, key))
        toasts.show({ message: `${card.companyName} agora é de ${ownerUserName} e saiu deste filtro.` })
      } else {
        mutate((current) => ({ columns: replaceCard(current, updated), revalidate: [] }))
        toasts.show({ message: `${card.companyName} agora é de ${ownerUserName}.` })
      }
      revalidateMetrics()
    } catch (error) {
      mutate((current) => ({ columns: replaceCard(current, card), revalidate: [] }))
      toasts.show({ tone: "danger", message: toMessage(error, "Não foi possível reatribuir o negócio.") })
      flagReturned(card.id)
    } finally {
      setPending(card.id, false)
    }
  }

  /** Só o cartão, depois de registrar atividade ou criar tarefa — o quadro não recarrega. */
  async function revalidateCard(id: string) {
    realtime.markOwn(id)
    try {
      const card = await getDealBoardCard(id)
      mutate((current) => ({ columns: replaceCard(current, card), revalidate: [] }))
    } catch {
      // O cartão fica como está: nada do que foi registrado se perde por isso.
    }
    revalidateMetrics()
  }

  return {
    period,
    periodLabel: pipelinePeriodLabel(period),
    owner,
    filters,
    sort,
    closedTab,
    stalledOnly,
    months,
    range,
    today,
    columns,
    board,
    /** Os parâmetros vigentes — a lista lateral do "Ver todos" usa os mesmos. */
    params,
    summary,
    insights,
    evolution,
    activities,
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
    setStalledOnly,
    setMonths,
    moveDeal,
    reassignDeal,
    applyClosed,
    revalidateCard,
    loadMore,
    /** Tempo real (item 23): cartões realçados, o eco das próprias ações e o que prende a fila. */
    pulsedIds: realtime.pulsedIds,
    realtimeAnnouncement: realtime.announcement,
    markOwn: realtime.markOwn,
    setDragging: realtime.setDragging,
    setHoveredColumn: realtime.setHoveredColumn,
    /** Depois de uma ação fora do quadro (drawer, novo negócio): recarrega sem esqueleto. */
    revalidate: () => {
      board.reload({ silent: true })
      revalidateMetrics()
    },
  }
}

export type DealBoardView = ReturnType<typeof useDealBoard>
