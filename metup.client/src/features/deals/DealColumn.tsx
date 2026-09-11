import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import { DealCard } from "./DealCard"
import type { DealListItem, DealStage } from "./api"
import { stageLabels } from "./stage-labels"

type Props = {
  stage: DealStage
  deals: DealListItem[]
  movingDealId: string | null
  onOpenDeal: (dealId: string) => void
  onMoveStage: (dealId: string, stage: DealStage) => void
}

export function DealColumn({ stage, deals, movingDealId, onOpenDeal, onMoveStage }: Props) {
  const total = deals.reduce((sum, deal) => sum + (deal.amount ?? deal.ticket ?? 0), 0)
  const isTerminal = stage === "Ganho" || stage === "Perdido"

  return (
    <section
      aria-label={`Estágio ${stageLabels[stage]}`}
      className="flex w-72 shrink-0 flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3"
    >
      <header className="flex flex-col gap-0.5 px-1">
        <div className="flex items-center justify-between gap-2">
          <h3
            className={cn(
              "text-sm font-semibold",
              stage === "Ganho" ? "text-success" : stage === "Perdido" ? "text-destructive" : "text-foreground"
            )}
          >
            {stageLabels[stage]}
          </h3>
          <span className="tabular text-xs font-medium text-muted-foreground">{deals.length}</span>
        </div>
        {total > 0 && <p className="tabular text-xs text-muted-foreground">{formatMoney(total)}</p>}
      </header>

      <div className="flex min-h-16 flex-col gap-2">
        {deals.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            {isTerminal ? "Nenhum negócio aqui ainda." : "Sem negócios neste estágio."}
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
