import { ArrowRightLeft, Loader2 } from "lucide-react"

import { Monogram } from "@/components/ui/monogram"
import { formatShortDate } from "@/lib/format"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { DealListItem, DealStage } from "./api"
import { ACTIVE_STAGES, sourceLabels, stageLabels } from "./stage-labels"

type Props = {
  deal: DealListItem
  isMoving: boolean
  onOpen: () => void
  onMoveStage: (stage: DealStage) => void
}

/**
 * Cartão do kanban. Hierarquia de decisão: com quem (empresa), quanto vale, quem cuida.
 * Mover de estágio é um controle no canto — some da leitura no desktop até o hover/foco,
 * e fica sempre visível em tela de toque, onde não existe hover.
 */
export function DealCard({ deal, isMoving, onOpen, onMoveStage }: Props) {
  const isOpen = deal.status === "Aberto"
  const value = deal.amount ?? deal.ticket

  return (
    <article
      data-deal-card
      className={cn(
        "group/card relative rounded-sm border border-line-soft bg-surface shadow-hairline transition-colors hover:border-line-strong/70",
        isMoving && "opacity-60"
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full cursor-pointer flex-col gap-3 rounded-sm p-3 text-left focus-visible:focus-ring"
      >
        <span className={cn("min-w-0", isOpen && "pr-8")}>
          <span className="block truncate text-base font-medium text-fg">{deal.companyName}</span>
          <span className="block truncate text-sm text-muted">{deal.contactName ?? "Sem contato definido"}</span>
        </span>

        <span className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-base font-medium tabular",
              value === null ? "text-faint" : deal.status === "Ganho" ? "text-success" : "text-fg"
            )}
          >
            {formatMoney(value)}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="label-mono truncate text-faint">{sourceLabels[deal.source]}</span>
            <span title={deal.ownerUserName} className="inline-flex">
              <Monogram name={deal.ownerUserName} size="xs" />
              <span className="sr-only">Responsável: {deal.ownerUserName}</span>
            </span>
          </span>
        </span>

        {!isOpen && deal.closedAt && (
          <span className="label-mono text-faint">
            Fechado em <span className="tabular">{formatShortDate(deal.closedAt)}</span>
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute top-2 right-2 size-7 transition-opacity",
            "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/card:opacity-100 [@media(hover:hover)]:focus-within:opacity-100",
            isMoving && "opacity-100"
          )}
        >
          <label htmlFor={`stage-${deal.id}`} className="sr-only">
            Mover {deal.companyName} para outro estágio
          </label>
          {/* Select nativo transparente sobre o ícone: menu do sistema (rápido e acessível), sem popover próprio. */}
          <select
            id={`stage-${deal.id}`}
            value=""
            disabled={isMoving}
            title="Mover de estágio"
            onChange={(e) => {
              if (e.target.value) onMoveStage(e.target.value as DealStage)
            }}
            className="size-7 cursor-pointer appearance-none rounded-xs border border-line-soft bg-surface-2 text-transparent transition-colors outline-none hover:border-line-strong focus-visible:focus-ring disabled:cursor-wait [&>option]:text-fg"
          >
            <option value="" disabled>
              Mover para…
            </option>
            {ACTIVE_STAGES.map((stage) => (
              <option key={stage} value={stage} disabled={stage === deal.stage}>
                {stageLabels[stage]}
                {stage === deal.stage ? " (atual)" : ""}
              </option>
            ))}
          </select>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-muted"
          >
            {isMoving ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRightLeft className="size-3.5" />}
          </span>
        </div>
      )}
    </article>
  )
}
