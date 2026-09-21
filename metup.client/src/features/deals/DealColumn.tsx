import { useEffect, useRef, type ReactNode } from "react"
import { useDroppable } from "@dnd-kit/core"
import { ArrowRight, ChevronDown, CircleX, ListPlus, Loader2, Plus, Trophy } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { numberFormatter, pluralize } from "@/lib/format"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { DealBoardCard, DealBoardClosedGroup, DealStage } from "./api"
import type { DropTarget } from "./board-announcements"
import { canLoadMoreInColumn, type BoardColumnState } from "./board-state"
import { CLOSED_CARD_HINT_ID, DealCard, type DealCardActions } from "./DealCard"
import { stageIcons } from "./stage-icons"
import { stageLabels } from "./stage-labels"

/** O que cada zona de soltar leva para o `DndContext`. */
export type DropData = { target: DropTarget; mobileTab?: boolean }

export type CardHandlers = {
  now: Date
  pendingIds: ReadonlySet<string>
  returnedIds: ReadonlySet<string>
  /** O menu `⋮` do cartão (item 15): a página monta as ações, a coluna só entrega. */
  actionsFor: (card: DealBoardCard) => DealCardActions
}

type LoadState = {
  isLoadingMore: boolean
  loadError: string | undefined
  onLoadMore: () => void
  /** "Ver todos (N)": abre a etapa inteira na lista lateral (item 16). */
  onSeeAll: () => void
}

/* ─── Partes comuns ───────────────────────────────────────────────────────── */

/** "12 negócios · R$ 48.000,00 est." — números do servidor (a coluna inteira). */
function ColumnNumbers({ column }: { column: BoardColumnState }) {
  return (
    <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-sm text-fg-muted tabular">
      <span>{pluralize(column.count, "negócio", "negócios")}</span>
      <span aria-hidden="true" className="text-faint">
        ·
      </span>
      <span className={cn(column.total > 0 ? "text-fg" : "text-faint")}>{formatMoney(column.total)}</span>
      {column.totalHasEstimate && (
        <span className="label-mono text-muted" title="Parte do total é valor estimado (ticket)">
          est.
          <span className="sr-only"> (inclui valor estimado)</span>
        </span>
      )}
    </p>
  )
}

/**
 * A lista rolável da coluna: cartões, sentinela da rolagem infinita e o rodapé "Ver todos (N)".
 * O sentinela observa dentro da própria coluna (`root`), com folga para a página chegar antes do fim.
 */
function CardList({
  column,
  handlers,
  load,
  empty,
}: {
  column: BoardColumnState
  handlers: CardHandlers
  load: LoadState
  empty: ReactNode
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const canLoadMore = canLoadMoreInColumn(column.items.length, column.hasMore)
  const onLoadMore = useRef(load.onLoadMore)
  useEffect(() => {
    onLoadMore.current = load.onLoadMore
  })

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !canLoadMore || load.loadError) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore.current()
      },
      { root: listRef.current, rootMargin: "0px 0px 240px 0px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [canLoadMore, column.items.length, load.loadError])

  const remaining = column.count - column.items.length

  return (
    <>
      <div ref={listRef} data-column-list className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2">
        {column.items.length === 0 ? (
          empty
        ) : (
          <ul className="flex flex-col gap-2" aria-label={`Negócios em ${column.key === "won" ? "Ganhos" : column.key === "lost" ? "Perdidos" : stageLabels[column.key]}`}>
            {column.items.map((card) => (
              <li key={card.id}>
                <DealCard
                  card={card}
                  now={handlers.now}
                  isPending={handlers.pendingIds.has(card.id)}
                  isReturned={handlers.returnedIds.has(card.id)}
                  actions={handlers.actionsFor(card)}
                />
              </li>
            ))}
          </ul>
        )}

        {canLoadMore && <div ref={sentinelRef} aria-hidden="true" className="h-px shrink-0" />}
        {load.isLoadingMore && (
          <p role="status" className="flex items-center justify-center gap-2 py-2 text-xs text-muted">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Carregando mais…
          </p>
        )}
        {load.loadError && (
          <p role="alert" className="flex flex-col items-center gap-1 py-2 text-center text-xs text-danger">
            {load.loadError}
            <button type="button" onClick={load.onLoadMore} className="cursor-pointer rounded-xs text-fg underline underline-offset-2 focus-visible:focus-ring">
              Tentar novamente
            </button>
          </p>
        )}
      </div>

      {remaining > 0 && (
        <footer className="shrink-0 border-t border-line-soft p-1.5">
          <button
            type="button"
            onClick={load.onSeeAll}
            className="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xs text-sm text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg focus-visible:focus-ring disabled:cursor-progress"
          >
            Ver todos ({numberFormatter.format(column.count)})
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </button>
        </footer>
      )}
    </>
  )
}

const columnShell =
  "flex max-h-full min-h-0 w-68 shrink-0 flex-col rounded-sm border bg-sunken/60 transition-[border-color,box-shadow,background-color] duration-200 max-md:w-full"

/* ─── Coluna de etapa ─────────────────────────────────────────────────────── */

export function StageColumn({
  stage,
  column,
  position,
  highlighted,
  isDragActive,
  handlers,
  load,
  onAddDeal,
  onAddTask,
}: {
  stage: DealStage
  column: BoardColumnState
  position: number
  highlighted: boolean
  isDragActive: boolean
  handlers: CardHandlers
  load: LoadState
  onAddDeal: () => void
  onAddTask: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col:${stage}`,
    data: { target: { kind: "stage", stage } } satisfies DropData,
  })
  const Icon = stageIcons[stage]
  const headingId = `pipeline-col-${stage}`

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      data-stage={stage}
      data-highlighted={highlighted || undefined}
      data-over={isOver || undefined}
      className={cn(
        columnShell,
        "border-line-soft",
        highlighted && "border-accent/70 shadow-glow-accent",
        isOver && "border-accent bg-accent/5"
      )}
    >
      <header className="flex shrink-0 flex-col gap-1.5 border-b border-line-soft px-3 pt-3 pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 id={headingId} className="flex min-w-0 items-center gap-2 text-base font-medium text-fg">
            <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="truncate">{stageLabels[stage]}</span>
            <span className="sr-only">
              , coluna {position} de 8
            </span>
          </h2>
          <AddMenu stage={stage} onAddDeal={onAddDeal} onAddTask={onAddTask} />
        </div>
        <ColumnNumbers column={column} />
      </header>

      <CardList
        column={column}
        handlers={handlers}
        load={load}
        empty={
          <p
            className={cn(
              "flex flex-1 items-center justify-center rounded-xs border border-dashed px-3 py-8 text-center text-sm transition-colors",
              isOver ? "border-accent text-fg" : isDragActive ? "border-line-strong text-fg-muted" : "border-line-soft text-faint"
            )}
          >
            Solte aqui
          </p>
        }
      />
    </section>
  )
}

/** `+ Adicionar ▾`: o clique cria o negócio já nesta etapa; a seta abre as outras opções. */
function AddMenu({ stage, onAddDeal, onAddTask }: { stage: DealStage; onAddDeal: () => void; onAddTask: () => void }) {
  const button = "inline-flex h-8 cursor-pointer items-center text-xs text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg focus-visible:focus-ring"
  return (
    <div className="flex shrink-0 items-center rounded-xs border border-line-soft">
      <button
        type="button"
        onClick={onAddDeal}
        aria-label={`Adicionar negócio em ${stageLabels[stage]}`}
        title={`Adicionar negócio em ${stageLabels[stage]}`}
        className={cn(button, "gap-1 rounded-l-xs px-2")}
      >
        <Plus className="size-3.5" aria-hidden="true" />
        {/* Na coluna de 17rem só o "+" cabe sem cortar o nome da etapa; no celular a coluna é larga. */}
        <span className="md:hidden">Adicionar</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`Mais opções de adicionar em ${stageLabels[stage]}`} className={cn(button, "rounded-r-xs border-l border-line-soft px-1.5")}>
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onAddDeal}>
            <Plus aria-hidden="true" />
            Novo negócio
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onAddTask}>
            <ListPlus aria-hidden="true" />
            Nova tarefa em negócio desta etapa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/* ─── Fechados ────────────────────────────────────────────────────────────── */

/**
 * Fechados no período: alternância Ganhos/Perdidos no cabeçalho. Enquanto um cartão aberto é
 * arrastado, a coluna vira duas zonas — soltar em uma delas abre o diálogo de fechamento.
 */
export function ClosedColumn({
  won,
  lost,
  tab,
  onTab,
  showDropZones,
  highlighted,
  handlers,
  loadFor,
}: {
  won: BoardColumnState
  lost: BoardColumnState
  tab: DealBoardClosedGroup
  onTab: (tab: DealBoardClosedGroup) => void
  showDropZones: boolean
  highlighted: boolean
  handlers: CardHandlers
  loadFor: (group: DealBoardClosedGroup) => LoadState
}) {
  const column = tab === "won" ? won : lost
  const toggle =
    "inline-flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xs px-2 text-xs transition-colors focus-visible:focus-ring"

  return (
    <section
      aria-labelledby="pipeline-col-closed"
      data-stage="Fechados"
      data-highlighted={highlighted || undefined}
      className={cn(columnShell, "border-line-soft", highlighted && "border-accent/70 shadow-glow-accent")}
    >
      <header className="flex shrink-0 flex-col gap-2 border-b border-line-soft px-3 pt-3 pb-2.5">
        <h2 id="pipeline-col-closed" className="flex min-w-0 items-center gap-2 text-base font-medium text-fg">
          <Trophy className="size-4 shrink-0 text-muted" aria-hidden="true" />
          Fechados
          <span className="sr-only">, coluna 8 de 8, no período escolhido</span>
        </h2>
        <div role="group" aria-label="Mostrar em Fechados" className="flex gap-1 rounded-sm bg-surface-2 p-0.5">
          {(["won", "lost"] as const).map((group) => {
            const active = tab === group
            const count = group === "won" ? won.count : lost.count
            return (
              <button
                key={group}
                type="button"
                aria-pressed={active}
                onClick={() => onTab(group)}
                className={cn(toggle, active ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg")}
              >
                <span aria-hidden="true" className={cn("size-1.5 rounded-full", group === "won" ? "bg-success" : "bg-danger")} />
                {group === "won" ? "Ganhos" : "Perdidos"}
                <span className="tabular text-muted">{numberFormatter.format(count)}</span>
              </button>
            )
          })}
        </div>
        <ColumnNumbers column={column} />
      </header>

      {showDropZones ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
          <CloseZone won />
          <CloseZone won={false} />
        </div>
      ) : (
        <CardList
          column={column}
          handlers={handlers}
          load={loadFor(tab)}
          empty={
            <p className="flex flex-1 items-center justify-center rounded-xs border border-dashed border-line-soft px-3 py-8 text-center text-sm text-faint">
              Nenhum fechamento no período
            </p>
          }
        />
      )}
      <p id={CLOSED_CARD_HINT_ID} className="sr-only">
        Negócio fechado não volta ao funil e não pode ser arrastado.
      </p>
    </section>
  )
}

function CloseZone({ won }: { won: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: won ? "zone:won" : "zone:lost",
    data: { target: { kind: "close", won } } satisfies DropData,
  })
  const Icon = won ? Trophy : CircleX

  return (
    <div
      ref={setNodeRef}
      data-close-zone={won ? "won" : "lost"}
      data-over={isOver || undefined}
      className={cn(
        "flex min-h-28 flex-1 flex-col items-center justify-center gap-1.5 rounded-sm border-2 border-dashed px-3 text-center transition-colors",
        won
          ? isOver
            ? "border-success bg-success/10 text-success"
            : "border-success/40 text-fg-muted"
          : isOver
            ? "border-danger bg-danger/10 text-danger"
            : "border-danger/40 text-fg-muted"
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      <span className="text-base font-medium">{won ? "Ganho" : "Perdido"}</span>
      <span className="text-xs text-muted">Soltar abre a confirmação</span>
    </div>
  )
}
