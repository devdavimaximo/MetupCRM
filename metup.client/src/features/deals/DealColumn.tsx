import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import { DealCard } from "./DealCard"
import type { DealListItem, DealStage } from "./api"
import { ALL_STAGES, stageLabels } from "./stage-labels"

type Props = {
  stage: DealStage
  deals: DealListItem[]
  movingDealId: string | null
  highlighted?: boolean
  onOpenDeal: (dealId: string) => void
  onMoveStage: (dealId: string, stage: DealStage) => void
}

export function DealColumn({ stage, deals, movingDealId, highlighted = false, onOpenDeal, onMoveStage }: Props) {
  const total = deals.reduce((sum, deal) => sum + (deal.amount ?? deal.ticket ?? 0), 0)
  const isWon = stage === "Ganho"
  const isLost = stage === "Perdido"
  const position = ALL_STAGES.indexOf(stage) + 1

  return (
    <section
      aria-label={`Estágio ${stageLabels[stage]}`}
      data-stage={stage}
      data-highlighted={highlighted || undefined}
      className={cn(
        "flex max-h-full w-[18rem] shrink-0 flex-col rounded-sm border border-line-soft bg-sunken/60 transition-[border-color,box-shadow] duration-500",
        highlighted && "border-accent/70 shadow-glow-accent"
      )}
    >
      <header className="flex shrink-0 flex-col gap-1 border-b border-line-soft px-3 pt-3 pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex min-w-0 items-center gap-2 text-base font-medium text-fg">
            {isWon || isLost ? (
              <span aria-hidden="true" className={cn("size-1.5 rounded-full", isWon ? "bg-success" : "bg-danger")} />
            ) : (
              <span aria-hidden="true" className="font-mono text-2xs text-faint tabular">
                {String(position).padStart(2, "0")}
              </span>
            )}
            <span className="truncate">{stageLabels[stage]}</span>
          </h2>
          <span className="rounded-xs bg-surface-3 px-1.5 font-mono text-2xs text-fg-muted tabular">{deals.length}</span>
        </div>
        <p className={cn("text-sm tabular", total > 0 ? "text-fg-muted" : "text-faint")}>
          {total > 0 ? formatMoney(total) : "—"}
        </p>
      </header>

      <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2">
        {deals.length === 0 && (
          <p className="flex flex-1 items-center justify-center rounded-xs border border-dashed border-line-soft px-3 py-8 text-center text-sm text-faint">
            {isWon ? "Nenhum ganho ainda" : isLost ? "Nenhuma perda registrada" : "Sem negócios aqui"}
          </p>
        )}

        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            isMoving={movingDealId === deal.id}
            onOpen={() => onOpenDeal(deal.id)}
            onMoveStage={(newStage) => onMoveStage(deal.id, newStage)}
          />
        ))}
      </div>
    </section>
  )
}
