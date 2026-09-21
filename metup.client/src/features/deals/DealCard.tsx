import { useRef, useState, type PointerEvent, type RefObject } from "react"
import { useDraggable } from "@dnd-kit/core"
import {
  ArrowRightLeft,
  Building2,
  CalendarPlus,
  CircleX,
  ClockAlert,
  EllipsisVertical,
  Loader2,
  NotebookPen,
  PanelRightOpen,
  Trophy,
  UserRoundCog,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Monogram } from "@/components/ui/monogram"
import { activityTypeLabels } from "@/features/activities/activity-labels"
import { formatDue, formatShortDate } from "@/lib/format"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { DealBoardCard, DealStage } from "./api"
import { ageTitle, formatAge, lastTouchOf, stalledLabel } from "./board-format"
import { ACTIVE_STAGES, lostReasonLabels, sourceLabels, stageLabels } from "./stage-labels"

/** Id da dica lida pelo leitor de tela nos cartões fechados. */
export const CLOSED_CARD_HINT_ID = "deal-card-closed-hint"

/** Dados que o cartão arrastado leva para o `DndContext`. */
export type DraggedCardData = { card: DealBoardCard }

/**
 * O miolo do cartão, sem comportamento: o mesmo no quadro e na sobreposição do arrasto.
 * Hierarquia: com quem (empresa), quanto vale, que tipo de conta é, quem cuida e há quanto tempo.
 */
export function DealCardContent({ card, now }: { card: DealBoardCard; now: Date }) {
  const isOpen = card.status === "Aberto"
  const isWon = card.status === "Ganho"
  const touch = lastTouchOf(card)

  return (
    <span className="flex min-w-0 flex-col gap-2.5">
      <span className="block truncate pr-7 text-base font-medium text-fg">{card.companyName}</span>

      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className={cn("text-base font-medium tabular", card.value === null ? "text-faint" : isWon ? "text-success" : "text-fg")}>
          {formatMoney(card.value)}
        </span>
        {card.valueIsEstimated && (
          <span className="label-mono text-muted" title="Valor estimado (ticket), ainda sem valor em negociação">
            est.
          </span>
        )}
        {isOpen && card.isStalled && (
          <Badge variant="accent" dot className="ml-auto">
            {stalledLabel(card.daysInStage)}
          </Badge>
        )}
      </span>

      <span className="flex min-w-0 flex-wrap gap-1">
        {card.companySegment && (
          <Badge variant="default" className="max-w-full truncate normal-case tracking-normal">
            {card.companySegment}
          </Badge>
        )}
        <Badge variant="outline" className="normal-case tracking-normal">
          {sourceLabels[card.source]}
        </Badge>
      </span>

      {!isOpen && card.closedAt && (
        <span className="label-mono text-muted">
          {isWon ? "Ganho em" : "Perdido em"} <span className="tabular">{formatShortDate(card.closedAt)}</span>
          {card.status === "Perdido" && card.lostReason && <span className="text-fg-muted"> · {lostReasonLabels[card.lostReason]}</span>}
        </span>
      )}

      <span className="flex min-w-0 items-center gap-2 border-t border-line-soft pt-2">
        <Monogram name={card.ownerUserName} size="xs" />
        <span className="min-w-0 flex-1 truncate text-sm text-fg-muted">
          <span className="sr-only">Responsável: </span>
          {card.ownerUserName}
        </span>
        {isOpen && card.nextTask?.isOverdue && (
          <span title={`Próxima ação atrasada: ${activityTypeLabels[card.nextTask.type]} · ${formatDue(card.nextTask.dueDate)}`} className="inline-flex">
            <ClockAlert className="size-4 text-danger" aria-hidden="true" />
            <span className="sr-only">
              Próxima ação atrasada: {activityTypeLabels[card.nextTask.type]}, {formatDue(card.nextTask.dueDate)}.
            </span>
          </span>
        )}
        <time dateTime={touch.iso} title={ageTitle(card)} className="shrink-0 text-xs text-muted tabular">
          {formatAge(touch.iso, now)}
        </time>
      </span>

      {isOpen && !card.nextTask && <span className="-mt-1 text-xs text-faint">Sem próxima ação</span>}
    </span>
  )
}

/**
 * Cartão do quadro. O cartão inteiro abre o negócio (clique ou Enter) e é a alça do arrasto
 * (arrastar 6px com o mouse, pressionar 250ms no toque, Espaço no teclado). O `⋮` é a alternativa
 * sem arrasto: Abrir negócio e Mover para….
 *
 * Fechado não volta ao funil (o domínio não reabre): não arrasta; tentar mostra o cursor de
 * proibido e a dica.
 */
export function DealCard({
  card,
  now,
  isPending,
  isReturned,
  isPulsed,
  tabStop,
  requestMove,
  actions,
}: {
  card: DealBoardCard
  now: Date
  /** Chamada em voo: não arrasta de novo até responder. */
  isPending: boolean
  /** Voltou ao lugar (erro/409): realce breve. */
  isReturned: boolean
  /** Mudou por outro usuário (tempo real): pulso sutil. */
  isPulsed: boolean
  /** O único cartão do quadro no Tab (roving tabindex): as setas levam aos outros. */
  tabStop: boolean
  /** O `M` pediu "Mover para…" neste cartão: o menu abre já na lista de etapas. */
  requestMove: boolean
  actions: DealCardActions
}) {
  const { onOpen } = actions
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const isOpen = card.status === "Aberto"
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { card } satisfies DraggedCardData,
    disabled: !isOpen || isPending,
  })
  const [blocked, setBlocked] = useState(false)
  const pressStart = useRef<{ x: number; y: number } | null>(null)

  // Tentativa de arrastar um fechado: o gesto é reconhecido (6px) e respondido com a dica.
  const closedGesture = isOpen
    ? {}
    : {
        onPointerDown: (event: PointerEvent) => {
          pressStart.current = { x: event.clientX, y: event.clientY }
        },
        onPointerMove: (event: PointerEvent) => {
          const start = pressStart.current
          if (!start || blocked) return
          if (Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 6) setBlocked(true)
        },
        onPointerUp: () => {
          pressStart.current = null
          if (blocked) window.setTimeout(() => setBlocked(false), 1600)
        },
        onPointerCancel: () => {
          pressStart.current = null
          setBlocked(false)
        },
      }

  return (
    <article
      ref={setNodeRef}
      data-deal-card
      data-deal-id={card.id}
      data-status={card.status}
      data-pulse={isPulsed || undefined}
      aria-busy={isPending || undefined}
      className={cn(
        "group/card relative rounded-sm border border-line-soft bg-surface shadow-hairline transition-[border-color,opacity,box-shadow] duration-500 hover:border-line-strong/70 motion-reduce:transition-none",
        card.status === "Perdido" && "opacity-60 hover:opacity-90",
        isDragging && "border-dashed border-line-strong opacity-40",
        isPending && "opacity-70",
        isPulsed && "border-accent/70 shadow-glow-accent",
        isReturned && "animate-in fade-in-0 zoom-in-95 border-danger/60 duration-300 motion-reduce:animate-none"
      )}
    >
      <button
        ref={(node) => {
          buttonRef.current = node
          setActivatorNodeRef(node)
        }}
        type="button"
        {...attributes}
        {...listeners}
        {...closedGesture}
        tabIndex={tabStop ? 0 : -1}
        onFocus={actions.onFocus}
        aria-disabled={undefined}
        aria-roledescription={isOpen ? "negócio arrastável" : "negócio"}
        aria-describedby={isOpen ? attributes["aria-describedby"] : CLOSED_CARD_HINT_ID}
        title={isOpen ? undefined : "Negócio fechado não volta ao funil."}
        onClick={onOpen}
        className={cn(
          "flex w-full touch-manipulation flex-col rounded-sm p-3 text-left select-none focus-visible:focus-ring",
          isOpen ? (isPending ? "cursor-progress" : "cursor-grab active:cursor-grabbing") : blocked ? "cursor-not-allowed" : "cursor-pointer"
        )}
      >
        <DealCardContent card={card} now={now} />
      </button>

      {blocked && (
        <p role="status" className="absolute inset-x-2 bottom-2 rounded-xs border border-line-strong bg-surface-3 px-2 py-1.5 text-xs text-fg shadow-raised">
          Negócio fechado não volta ao funil.
        </p>
      )}

      <div className="absolute top-2 right-2">
        {isPending ? (
          <span className="inline-flex size-8 items-center justify-center text-muted" aria-hidden="true">
            <Loader2 className="size-4 animate-spin" />
          </span>
        ) : (
          <CardMenu card={card} actions={actions} tabStop={tabStop} requestMove={requestMove && isOpen} cardButton={buttonRef} />
        )}
      </div>
    </article>
  )
}

/** O que o `⋮` do cartão sabe fazer (item 15). Reatribuir só aparece para Admin/Closer. */
export type DealCardActions = {
  onOpen: () => void
  onMove: (stage: DealStage) => void
  onLogActivity: () => void
  onNewTask: () => void
  onClose: (won: boolean) => void
  onReassign: () => void
  onOpenCompany: () => void
  canReassign: boolean
  /** O cartão ganhou foco: vira o ponto de entrada do Tab no quadro. */
  onFocus: () => void
  /** O menu aberto pelo `M` fechou (com ou sem escolha). */
  onMoveRequestDone: () => void
}

/**
 * O `⋮`. Pelo `M` ele abre direto na lista de etapas ("Mover para…") e, ao fechar, devolve o foco
 * ao cartão — não ao `⋮`, que o teclado não pediu.
 */
function CardMenu({
  card,
  actions,
  tabStop,
  requestMove,
  cardButton,
}: {
  card: DealBoardCard
  actions: DealCardActions
  tabStop: boolean
  requestMove: boolean
  cardButton: RefObject<HTMLButtonElement | null>
}) {
  const { onOpen, onMove } = actions
  const isOpen = card.status === "Aberto"
  const [open, setOpen] = useState(false)

  const stageItems = ACTIVE_STAGES.map((stage) => (
    <DropdownMenuItem key={stage} disabled={stage === card.stage} onSelect={() => onMove(stage)}>
      {stageLabels[stage]}
      {stage === card.stage && <span className="ml-auto text-xs text-faint">atual</span>}
    </DropdownMenuItem>
  ))

  return (
    <DropdownMenu
      open={open || requestMove}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next && requestMove) actions.onMoveRequestDone()
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          tabIndex={tabStop ? 0 : -1}
          aria-label={`Ações de ${card.companyName}`}
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-xs text-muted transition-colors hover:bg-surface-3 hover:text-fg focus-visible:focus-ring data-[state=open]:bg-surface-3 data-[state=open]:text-fg max-md:size-11"
        >
          <EllipsisVertical className="size-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      {requestMove ? (
        <DropdownMenuContent
          aria-label={`Mover ${card.companyName} para`}
          aria-labelledby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            cardButton.current?.focus()
          }}
        >
          <DropdownMenuLabel>Mover para…</DropdownMenuLabel>
          {stageItems}
        </DropdownMenuContent>
      ) : (
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onOpen}>
            <PanelRightOpen aria-hidden="true" />
            Abrir negócio
          </DropdownMenuItem>
          {isOpen && (
            <>
              <DropdownMenuItem onSelect={actions.onLogActivity}>
                <NotebookPen aria-hidden="true" />
                Registrar atividade
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={actions.onNewTask}>
                <CalendarPlus aria-hidden="true" />
                Nova tarefa
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ArrowRightLeft aria-hidden="true" />
                  Mover para…
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent aria-label="Etapas">{stageItems}</DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onSelect={() => actions.onClose(true)}>
                <Trophy aria-hidden="true" />
                Marcar como ganho
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => actions.onClose(false)}>
                <CircleX aria-hidden="true" />
                Marcar como perdido
              </DropdownMenuItem>
              {/* Reatribuir é ação de Admin/Closer — para o SDR a opção nem aparece (e o servidor recusa). */}
              {actions.canReassign && (
                <DropdownMenuItem onSelect={actions.onReassign}>
                  <UserRoundCog aria-hidden="true" />
                  Reatribuir responsável
                </DropdownMenuItem>
              )}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={actions.onOpenCompany}>
            <Building2 aria-hidden="true" />
            Abrir empresa
          </DropdownMenuItem>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  )
}
