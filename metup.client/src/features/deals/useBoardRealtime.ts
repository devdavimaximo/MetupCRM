import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react"

import { ApiError } from "@/lib/api"
import { useRealtime, type RealtimeEvent } from "@/lib/realtime"
import { getDealBoardCard } from "./api"
import {
  applyRemoteCard,
  cardMatchesFilter,
  DeferredEvents,
  dropCard,
  RecentOwnActions,
  type BoardRealtimeFilter,
  type RemoteResult,
} from "./board-realtime"
import type { BoardColumns, ColumnKey } from "./board-state"
import { stageLabels } from "./stage-labels"

/** Folga para KPIs, funil, insights, evolução e atividades — eventos chegam em rajada. */
export const REALTIME_METRICS_DEBOUNCE_MS = 2_000
/** Quanto tempo o cartão que mudou por outro usuário fica realçado. */
const PULSE_MS = 1_600

type Options = {
  columnsRef: MutableRefObject<BoardColumns | null>
  /** Muda a cada carga do quadro: leitura de cartão de um quadro anterior é descartada. */
  generationRef: MutableRefObject<number>
  pendingRef: MutableRefObject<ReadonlySet<string>>
  filterRef: MutableRefObject<BoardRealtimeFilter>
  commit: (result: RemoteResult) => void
  reloadBoard: () => void
  reloadMetrics: (delayMs: number) => void
}

/**
 * Tempo real do quadro (item 23). O hub diz qual negócio mudou; a tela relê o cartão e o aplica no
 * lugar, com um pulso sutil. Regras:
 * - nada é aplicado durante um arrasto, no cartão com chamada em voo, nem numa coluna sob o cursor
 *   quando a mudança troca cartões de posição: o evento espera e é aplicado quando a interação
 *   termina (relendo o cartão, então vale o estado mais novo);
 * - o eco de uma ação do próprio usuário (a atualização otimista já aconteceu) não pulsa nem relê;
 * - KPIs e companhia são revalidados em silêncio, com folga de 2 s;
 * - `revalidate` (reconexão, foco da aba, intervalo sem conexão) recarrega o quadro inteiro.
 */
export function useBoardRealtime({ columnsRef, generationRef, pendingRef, filterRef, commit, reloadBoard, reloadMetrics }: Options) {
  const own = useRef(new RecentOwnActions())
  const deferred = useRef(new DeferredEvents())
  const dragging = useRef(false)
  const hoveredColumn = useRef<ColumnKey | null>(null)
  const [pulsedIds, setPulsedIds] = useState<ReadonlySet<string>>(() => new Set())
  /** O pulso é visual; o leitor de tela ouve a mesma mudança numa região `aria-live`. */
  const [announcement, setAnnouncement] = useState("")
  const timers = useRef(new Set<number>())

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const pulse = useCallback((id: string) => {
    setPulsedIds((ids) => new Set(ids).add(id))
    const timer = window.setTimeout(() => {
      timers.current.delete(timer)
      setPulsedIds((ids) => {
        const next = new Set(ids)
        next.delete(id)
        return next
      })
    }, PULSE_MS)
    timers.current.add(timer)
  }, [])

  const isLocked = (id: string) => dragging.current || pendingRef.current.has(id)

  async function fetchAndApply(id: string) {
    const generation = generationRef.current
    let result: RemoteResult
    let name = ""
    try {
      const card = await getDealBoardCard(id)
      name = card.status === "Aberto" ? `${card.companyName}, ${stageLabels[card.stage]}` : `${card.companyName}, ${card.status}`
      if (generation !== generationRef.current || !columnsRef.current) return
      if (isLocked(id)) return deferred.current.defer(id)
      result = applyRemoteCard(columnsRef.current, card, cardMatchesFilter(card, filterRef.current))
    } catch (error) {
      // Sumiu para esta tela (apagado ou fora da organização): sai do quadro. Outro erro: fica como está.
      if (!(error instanceof ApiError && error.status === 404) || !columnsRef.current) return
      result = dropCard(columnsRef.current, id)
    }

    const reorders = result.change !== "updated" && result.change !== "none"
    if (reorders && hoveredColumn.current !== null && result.touched.includes(hoveredColumn.current)) {
      return deferred.current.defer(id)
    }
    if (result.change === "none") return
    commit(result)
    if (result.change !== "removed") pulse(id)
    if (name) setAnnouncement(`Atualizado por outro usuário: ${name}.`)
  }

  /** Aplica o que ficou esperando, se a interação que prendia já terminou. */
  function flush() {
    const ready = deferred.current.take((id) => !isLocked(id), !dragging.current)
    if (ready.board) reloadBoard()
    ready.ids.forEach((id) => void fetchAndApply(id))
  }

  useRealtime((event: RealtimeEvent) => {
    reloadMetrics(REALTIME_METRICS_DEBOUNCE_MS)
    if (event.type === "revalidate") {
      if (dragging.current) deferred.current.defer(null)
      else reloadBoard()
      return
    }
    const id = event.dealId
    if (id === null || own.current.has(id)) return
    if (isLocked(id)) deferred.current.defer(id)
    else void fetchAndApply(id)
  })

  return {
    pulsedIds,
    announcement,
    /** O usuário acabou de mexer neste negócio: o eco do hub é dele. */
    markOwn: (id: string) => own.current.mark(id),
    setDragging: (on: boolean) => {
      dragging.current = on
      if (!on) flush()
    },
    setHoveredColumn: (key: ColumnKey | null) => {
      hoveredColumn.current = key
      if (key === null) flush()
    },
    /** A chamada em voo de um cartão terminou. */
    settled: flush,
  }
}
