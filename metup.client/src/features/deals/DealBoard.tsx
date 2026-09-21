import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type TouchEvent } from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core"
import { Trophy } from "lucide-react"

import { useMediaQuery } from "@/lib/hooks"
import { numberFormatter } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { DealBoardCard, DealBoardClosedGroup, DealStage } from "./api"
import { isBoardArrow, nextFocus, tabStopOf } from "./board-keyboard"
import { boardAnnouncements, boardScreenReaderInstructions, targetPosition, type DropTarget } from "./board-announcements"
import type { ColumnKey } from "./board-state"
import { DealCardContent, type DealCardActions, type DraggedCardData } from "./DealCard"
import { ClosedColumn, StageColumn, type CardHandlers, type DropData } from "./DealColumn"
import { stageIcons } from "./stage-icons"
import { ACTIVE_STAGES, stageLabels } from "./stage-labels"
import type { DealBoardView } from "./useDealBoard"

type Props = {
  view: DealBoardView
  /** Coluna para rolar até e destacar ao chegar (o `?etapa=` do dashboard). */
  highlightStage: DealStage | null
  onOpenDeal: (card: DealBoardCard) => void
  onAddDeal: (stage: DealStage) => void
  onAddTask: (stage: DealStage) => void
  /** Soltou em Ganho/Perdido: o diálogo decide; o cartão não sai do lugar até confirmar. */
  onCloseRequest: (card: DealBoardCard, won: boolean) => void
  /** Item 15: o resto do menu `⋮`, montado pela página (registrar, nova tarefa, reatribuir, empresa). */
  cardMenu: (card: DealBoardCard) => Omit<DealCardActions, "onOpen" | "onMove" | "onFocus" | "onMoveRequestDone">
  /** "Ver todos (N)": abre a coluna inteira na lista lateral (item 16). */
  onSeeAll: (key: ColumnKey) => void
  /** O `M` da página: abre "Mover para…" no cartão focado. */
  moveRequestId: string | null
  onMoveRequestDone: () => void
}

const HIGHLIGHT_MS = 2800

/** Uma "aba" do celular: uma etapa ou Fechados. */
type MobileKey = DealStage | "closed"
const MOBILE_KEYS: MobileKey[] = [...ACTIVE_STAGES, "closed"]

const dropTargetOf = (data: unknown): DropTarget | null => (data as DropData | undefined)?.target ?? null
const cardOf = (data: unknown): DealBoardCard | null => (data as DraggedCardData | undefined)?.card ?? null

/** Ponteiro dentro de uma zona primeiro; sem ponteiro (teclado), a maior interseção. */
const collisionDetection: CollisionDetection = (args) => {
  const byPointer = pointerWithin(args)
  return byPointer.length > 0 ? byPointer : rectIntersection(args)
}

/**
 * Teclado: ←/→ levam o cartão para a coluna vizinha (em Fechados, Ganho e depois Perdido). ↑/↓ não
 * fazem nada — não há ordem manual dentro da coluna (decisão 2).
 */
const keyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  if (event.code !== "ArrowRight" && event.code !== "ArrowLeft") return undefined
  event.preventDefault()
  const { active, collisionRect, droppableContainers, droppableRects, over } = context
  if (!collisionRect) return undefined

  const targets = droppableContainers
    .getEnabled()
    .map((container) => ({ id: container.id, data: container.data.current as DropData | undefined }))
    .filter((t): t is { id: string; data: DropData } => Boolean(t.data?.target) && !t.data?.mobileTab)
    .sort((a, b) => order(a.data.target) - order(b.data.target))
  if (targets.length === 0) return undefined

  const origin = cardOf(active?.data.current)
  const currentId = over?.id ?? (origin ? `col:${origin.stage}` : null)
  const index = targets.findIndex((t) => t.id === currentId)
  const nextIndex = Math.max(0, Math.min(targets.length - 1, (index === -1 ? 0 : index) + (event.code === "ArrowRight" ? 1 : -1)))
  const rect = droppableRects.get(targets[nextIndex].id)
  if (!rect) return undefined

  // Os retângulos das colunas já vêm em coordenadas da janela, como o do cartão — nada de somar
  // nem descontar a rolagem da página aqui.
  return { x: rect.left + (rect.width - collisionRect.width) / 2, y: rect.top + 8 }
}

const order = (target: DropTarget) => targetPosition(target) + (target.kind === "close" && !target.won ? 0.5 : 0)

/**
 * O quadro: 7 etapas + Fechados. Só o quadro rola na horizontal (sombras nas bordas avisam que há
 * mais colunas); cada coluna rola na vertical. Abaixo de 768px, uma coluna por vez com abas.
 */
export function DealBoard({
  view,
  highlightStage,
  onOpenDeal,
  onAddDeal,
  onAddTask,
  onCloseRequest,
  cardMenu,
  onSeeAll,
  moveRequestId,
  onMoveRequestDone,
}: Props) {
  const columns = view.columns!
  const isMobile = useMediaQuery("(max-width: 767px)")
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const [activeCard, setActiveCard] = useState<DealBoardCard | null>(null)
  const [highlighted, setHighlighted] = useState<DealStage | null>(highlightStage)
  const [mobileKey, setMobileKey] = useState<MobileKey>(highlightStage ?? ACTIVE_STAGES[0])
  const [focusedId, setFocusedId] = useState<string | null>(null)
  // Destaque novo (funil, insights): no celular a aba da etapa abre; no desktop a coluna realça de novo.
  const [lastHighlight, setLastHighlight] = useState(highlightStage)
  if (highlightStage !== lastHighlight) {
    setLastHighlight(highlightStage)
    if (highlightStage) {
      setHighlighted(highlightStage)
      setMobileKey(highlightStage)
    }
  }
  const lastDragEnd = useRef(0)
  /** Cartão que o teclado moveu: o foco o acompanha até a coluna nova. */
  const refocusId = useRef<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const now = new Date()

  // O que está na tela, na ordem da tela: o Tab entra no último cartão focado (roving tabindex).
  const visibleKeys: ColumnKey[] = isMobile
    ? [mobileKey === "closed" ? view.closedTab : mobileKey]
    : [...ACTIVE_STAGES, view.closedTab]
  const tabStopId = tabStopOf(
    visibleKeys.map((key) => columns[key].items.map((card) => card.id)),
    focusedId
  )

  function focusCard(id: string) {
    const button = boardRef.current?.querySelector<HTMLElement>(`[data-deal-id="${CSS.escape(id)}"] button[aria-roledescription]`)
    if (!button) return false
    button.focus({ preventScroll: true })
    // A coluna (e o quadro, na horizontal) rola para acompanhar o foco.
    button.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reducedMotion ? "auto" : "smooth" })
    return true
  }

  // Depois de um movimento pelo teclado o cartão remonta em outra coluna: devolve o foco a ele.
  useEffect(() => {
    const id = refocusId.current
    if (id && focusCard(id)) refocusId.current = null
  })

  /**
   * Setas fora do arrasto (item 22): ↑/↓ na coluna, ←/→ para a coluna vizinha com cartão. No
   * celular, ←/→ trocam de aba. Durante o arrasto as setas são do dnd-kit.
   */
  function handleBoardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (activeCard || !isBoardArrow(event.key) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const target = event.target as HTMLElement
    const cardEl = target.closest<HTMLElement>("[data-deal-card]")
    if (!cardEl || !target.matches("button[aria-roledescription]")) return
    event.preventDefault()

    if (isMobile && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      const index = MOBILE_KEYS.indexOf(mobileKey)
      const next = MOBILE_KEYS[Math.max(0, Math.min(MOBILE_KEYS.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)))]
      const key = next === "closed" ? view.closedTab : next
      refocusId.current = columns[key].items[0]?.id ?? null
      setMobileKey(next)
      return
    }

    const grid = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-column-list]")].map((list) =>
      [...list.querySelectorAll<HTMLElement>("[data-deal-card]")].map((el) => el.dataset.dealId!)
    )
    const next = nextFocus(grid, cardEl.dataset.dealId!, event.key)
    if (next) focusCard(next)
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: keyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    })
  )

  useEffect(() => {
    if (!highlightStage) return
    const timer = window.setTimeout(() => setHighlighted(null), HIGHLIGHT_MS)
    return () => window.clearTimeout(timer)
  }, [highlightStage])

  const originOf = (card: DealBoardCard): DropTarget => ({ kind: "stage", stage: card.stage })
  // O `onDragOver` também dispara logo depois de pegar, sobre a própria coluna: só anuncia quando o
  // alvo muda, para o "pego" não ser atropelado.
  const lastAnnounced = useRef<string | null>(null)
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const card = cardOf(active.data.current)
      lastAnnounced.current = card ? `col:${card.stage}` : null
      return card ? boardAnnouncements.pickup(card.companyName, originOf(card)) : undefined
    },
    onDragOver: ({ over }) => {
      const id = over ? String(over.id).replace(/^tab:/, "col:") : null
      if (id === lastAnnounced.current) return undefined
      lastAnnounced.current = id
      return boardAnnouncements.over(dropTargetOf(over?.data.current))
    },
    onDragEnd: ({ active, over }) => {
      const card = cardOf(active.data.current)
      return card ? boardAnnouncements.drop(card.companyName, originOf(card), dropTargetOf(over?.data.current)) : undefined
    },
    onDragCancel: ({ active }) => {
      const card = cardOf(active.data.current)
      return card ? boardAnnouncements.cancel(card.companyName, originOf(card)) : undefined
    },
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveCard(cardOf(active.data.current))
    view.setDragging(true)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveCard(null)
    lastDragEnd.current = Date.now()
    const card = cardOf(active.data.current)
    const target = dropTargetOf(over?.data.current)
    if (card && target?.kind === "close") onCloseRequest(card, target.won)
    else if (card && target?.kind === "stage" && target.stage !== card.stage) {
      // O movimento marca o cartão como "em voo" antes de soltar a fila do tempo real.
      void view.moveDeal(card, target.stage)
      if (isMobile) setMobileKey(target.stage)
    }
    view.setDragging(false)
  }

  const handlers: CardHandlers = {
    now,
    pendingIds: view.pendingIds,
    returnedIds: view.returnedIds,
    pulsedIds: view.pulsedIds,
    tabStopId,
    moveRequestId,
    onHoverColumn: view.setHoveredColumn,
    actionsFor: (card) => ({
      ...cardMenu(card),
      // O clique que termina um arrasto não abre a ficha.
      onOpen: () => {
        if (Date.now() - lastDragEnd.current > 300) onOpenDeal(card)
      },
      onMove: (stage) => {
        if (moveRequestId === card.id) refocusId.current = card.id
        void view.moveDeal(card, stage)
      },
      onFocus: () => setFocusedId(card.id),
      onMoveRequestDone,
    }),
  }

  const loadFor = (key: ColumnKey) => ({
    isLoadingMore: Boolean(view.loadingMore[key]),
    loadError: view.loadMoreErrors[key],
    onLoadMore: () => void view.loadMore(key),
    onSeeAll: () => onSeeAll(key),
  })

  const dragOpen = activeCard !== null && activeCard.status === "Aberto"

  function renderColumn(key: MobileKey) {
    if (key === "closed") {
      return (
        <ClosedColumn
          key="closed"
          won={columns.won}
          lost={columns.lost}
          tab={view.closedTab}
          onTab={view.setClosedTab}
          showDropZones={dragOpen}
          highlighted={false}
          handlers={handlers}
          loadFor={(group: DealBoardClosedGroup) => loadFor(group)}
        />
      )
    }
    return (
      <StageColumn
        key={key}
        stage={key}
        column={columns[key]}
        position={ACTIVE_STAGES.indexOf(key) + 1}
        highlighted={highlighted === key}
        isDragActive={dragOpen}
        handlers={handlers}
        load={loadFor(key)}
        onAddDeal={() => onAddDeal(key)}
        onAddTask={() => onAddTask(key)}
      />
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      accessibility={{ announcements, screenReaderInstructions: { draggable: boardScreenReaderInstructions } }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveCard(null)
        lastDragEnd.current = Date.now()
        view.setDragging(false)
      }}
    >
      <div ref={boardRef} onKeyDown={handleBoardKeyDown} className="flex min-h-0 min-w-0 flex-1 flex-col">
      {isMobile ? (
        <MobileBoard
          view={view}
          activeKey={mobileKey}
          onActiveKey={setMobileKey}
          isDragging={activeCard !== null}
          renderColumn={renderColumn}
        />
      ) : (
        <DesktopBoard highlightStage={highlightStage}>{MOBILE_KEYS.map(renderColumn)}</DesktopBoard>
      )}
      </div>

      <DragOverlay dropAnimation={reducedMotion ? null : undefined}>
        {activeCard && (
          <div
            className={cn(
              "w-68 cursor-grabbing rounded-sm border border-accent/60 bg-surface p-3 shadow-panel max-md:w-[min(17rem,calc(100vw-3rem))]",
              !reducedMotion && "rotate-2"
            )}
          >
            <DealCardContent card={activeCard} now={now} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

/* ─── Desktop: rolagem só do quadro, com sombras nas bordas ──────────────── */

function DesktopBoard({ highlightStage, children }: { highlightStage: DealStage | null; children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  useEffect(() => {
    const board = scrollRef.current
    if (!board) return
    const update = () =>
      setEdges({ left: board.scrollLeft > 1, right: board.scrollLeft + board.clientWidth < board.scrollWidth - 1 })
    update()
    board.addEventListener("scroll", update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(board)
    return () => {
      board.removeEventListener("scroll", update)
      observer.disconnect()
    }
  }, [])

  // Chegada pelo `?etapa=`: centraliza a coluna.
  useEffect(() => {
    if (!highlightStage) return
    const board = scrollRef.current
    const column = board?.querySelector<HTMLElement>(`[data-stage="${highlightStage}"]`)
    if (!board || !column) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const left = column.offsetLeft - board.offsetLeft - (board.clientWidth - column.offsetWidth) / 2
    board.scrollTo({ left: Math.max(0, left), behavior: reduced ? "auto" : "smooth" })
  }, [highlightStage])

  const shadow = "pointer-events-none absolute inset-y-0 z-10 w-8 transition-opacity duration-200"

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1">
      <div
        ref={scrollRef}
        data-board-scroll
        role="region"
        aria-label="Quadro do pipeline"
        tabIndex={-1}
        className="relative flex min-h-0 min-w-0 flex-1 items-stretch gap-3 overflow-x-auto overscroll-x-contain px-4 pb-4 sm:px-6 lg:px-10"
      >
        {children}
      </div>
      <div aria-hidden="true" className={cn(shadow, "left-0 bg-linear-to-r from-bg to-transparent", edges.left ? "opacity-100" : "opacity-0")} />
      <div aria-hidden="true" className={cn(shadow, "right-0 bg-linear-to-l from-bg to-transparent", edges.right ? "opacity-100" : "opacity-0")} />
    </div>
  )
}

/* ─── Celular: uma coluna por vez, abas roláveis e swipe ─────────────────── */

function MobileBoard({
  view,
  activeKey,
  onActiveKey,
  isDragging,
  renderColumn,
}: {
  view: DealBoardView
  activeKey: MobileKey
  onActiveKey: (key: MobileKey) => void
  isDragging: boolean
  renderColumn: (key: MobileKey) => ReactNode
}) {
  const columns = view.columns!
  const touch = useRef<{ x: number; y: number } | null>(null)
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${activeKey}"]`)?.scrollIntoView({ block: "nearest", inline: "center" })
  }, [activeKey])

  function go(delta: number) {
    const index = MOBILE_KEYS.indexOf(activeKey)
    const next = MOBILE_KEYS[Math.max(0, Math.min(MOBILE_KEYS.length - 1, index + delta))]
    onActiveKey(next)
  }

  const onTouchStart = (event: TouchEvent) => {
    const t = event.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (event: TouchEvent) => {
    const start = touch.current
    touch.current = null
    if (!start || isDragging) return
    const t = event.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <div ref={tabsRef} role="tablist" aria-label="Etapas do pipeline" className="-mx-4 flex shrink-0 gap-1.5 overflow-x-auto px-4 scrollbar-none">
        {MOBILE_KEYS.map((key) => (
          <MobileTab
            key={key}
            tabKey={key}
            active={key === activeKey}
            count={key === "closed" ? columns.won.count + columns.lost.count : columns[key].count}
            onSelect={() => onActiveKey(key)}
          />
        ))}
      </div>
      <div
        id="pipeline-mobile-panel"
        role="tabpanel"
        aria-labelledby={`pipeline-tab-${activeKey}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="flex min-h-0 flex-1"
      >
        {renderColumn(activeKey)}
      </div>
    </div>
  )
}

/** Aba de etapa no celular. Também recebe o cartão (arrasto por pressionar): soltar aqui move. */
function MobileTab({ tabKey, active, count, onSelect }: { tabKey: MobileKey; active: boolean; count: number; onSelect: () => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `tab:${tabKey}`,
    disabled: tabKey === "closed",
    data: tabKey === "closed" ? undefined : ({ target: { kind: "stage", stage: tabKey }, mobileTab: true } satisfies DropData),
  })
  const Icon = tabKey === "closed" ? Trophy : stageIcons[tabKey]
  const label = tabKey === "closed" ? "Fechados" : stageLabels[tabKey]

  return (
    <button
      ref={setNodeRef}
      id={`pipeline-tab-${tabKey}`}
      data-tab={tabKey}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls="pipeline-mobile-panel"
      onClick={onSelect}
      className={cn(
        "inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border px-3 text-sm whitespace-nowrap transition-colors focus-visible:focus-ring",
        active ? "border-accent/60 bg-accent/10 text-fg" : "border-line-soft text-fg-muted",
        isOver && "border-accent bg-accent/15 text-fg"
      )}
    >
      <Icon className="size-4 text-muted" aria-hidden="true" />
      {label}
      <span className="rounded-xs bg-surface-3 px-1.5 text-2xs text-fg-muted tabular">{numberFormatter.format(count)}</span>
    </button>
  )
}
