import { useEffect, useRef, useState } from "react"

import { DealColumn } from "./DealColumn"
import type { DealListItem, DealStage } from "./api"
import { ALL_STAGES } from "./stage-labels"

type Props = {
  deals: DealListItem[]
  movingDealId: string | null
  /** Coluna para rolar até e destacar por alguns segundos ao abrir o quadro. */
  highlightStage?: DealStage | null
  onOpenDeal: (dealId: string) => void
  onMoveStage: (dealId: string, stage: DealStage) => void
}

const HIGHLIGHT_MS = 2800

/** O quadro rola na horizontal; cada coluna rola na vertical dentro da altura da tela. */
export function DealBoard({ deals, movingDealId, highlightStage = null, onOpenDeal, onMoveStage }: Props) {
  const boardRef = useRef<HTMLDivElement>(null)
  const [highlighted, setHighlighted] = useState(highlightStage)

  const dealsByStage = ALL_STAGES.reduce<Record<DealStage, DealListItem[]>>(
    (acc, stage) => {
      acc[stage] = deals.filter((deal) => deal.stage === stage)
      return acc
    },
    {} as Record<DealStage, DealListItem[]>
  )

  useEffect(() => {
    if (!highlightStage) return
    const board = boardRef.current
    const column = board?.querySelector<HTMLElement>(`[data-stage="${highlightStage}"]`)
    if (board && column) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      const left = column.offsetLeft - board.offsetLeft - (board.clientWidth - column.offsetWidth) / 2
      board.scrollTo({ left: Math.max(0, left), behavior: reduced ? "auto" : "smooth" })
    }
    const timer = window.setTimeout(() => setHighlighted(null), HIGHLIGHT_MS)
    return () => window.clearTimeout(timer)
  }, [highlightStage])

  return (
    <div ref={boardRef} className="flex min-h-0 flex-1 items-stretch gap-3 overflow-x-auto px-4 pb-4 sm:px-6 lg:px-10">
      {ALL_STAGES.map((stage) => (
        <DealColumn
          key={stage}
          stage={stage}
          deals={dealsByStage[stage]}
          movingDealId={movingDealId}
          highlighted={highlighted === stage}
          onOpenDeal={onOpenDeal}
          onMoveStage={onMoveStage}
        />
      ))}
    </div>
  )
}
