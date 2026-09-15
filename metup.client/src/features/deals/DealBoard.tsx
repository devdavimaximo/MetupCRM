import { DealColumn } from "./DealColumn"
import type { DealListItem, DealStage } from "./api"
import { ALL_STAGES } from "./stage-labels"

type Props = {
  deals: DealListItem[]
  movingDealId: string | null
  onOpenDeal: (dealId: string) => void
  onMoveStage: (dealId: string, stage: DealStage) => void
}

/** O quadro rola na horizontal; cada coluna rola na vertical dentro da altura da tela. */
export function DealBoard({ deals, movingDealId, onOpenDeal, onMoveStage }: Props) {
  const dealsByStage = ALL_STAGES.reduce<Record<DealStage, DealListItem[]>>(
    (acc, stage) => {
      acc[stage] = deals.filter((deal) => deal.stage === stage)
      return acc
    },
    {} as Record<DealStage, DealListItem[]>
  )

  return (
    <div className="flex min-h-0 flex-1 items-stretch gap-3 overflow-x-auto px-4 pb-4 sm:px-6 lg:px-10">
      {ALL_STAGES.map((stage) => (
        <DealColumn
          key={stage}
          stage={stage}
          deals={dealsByStage[stage]}
          movingDealId={movingDealId}
          onOpenDeal={onOpenDeal}
          onMoveStage={onMoveStage}
        />
      ))}
    </div>
  )
}
