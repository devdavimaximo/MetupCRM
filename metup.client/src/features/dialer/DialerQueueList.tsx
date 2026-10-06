import { PhoneOff } from "lucide-react"

import { activityOutcomeLabels } from "@/features/activities/activity-labels"
import { formatDue, formatOverdue } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { DialerQueueItem } from "./api"

/**
 * A fila da sessão, na ordem em que vai ser discada. Clicar escolhe quem ligar agora — a ordem não
 * muda. O item atual fica marcado (`aria-current`).
 */
export function DialerQueueList({
  items,
  currentDealId,
  onSelect,
}: {
  items: DialerQueueItem[]
  currentDealId: string | null
  onSelect: (dealId: string) => void
}) {
  return (
    <ol aria-label="Fila de ligações" className="flex flex-col">
      {items.map((item, index) => {
        const isCurrent = item.dealId === currentDealId
        const dialable = item.phones.some((phone) => phone.dial)
        const overdue = item.isOverdue ? formatOverdue(item.dueDate) : null
        return (
          <li key={item.dealId} className="[contain-intrinsic-size:auto_3.75rem] [content-visibility:auto]">
            <button
              type="button"
              aria-current={isCurrent ? "true" : undefined}
              onClick={() => onSelect(item.dealId)}
              className={cn(
                "flex w-full cursor-pointer items-start gap-3 border-l-2 px-3 py-2.5 text-left transition-colors focus-visible:focus-ring",
                isCurrent ? "border-accent bg-accent/10" : "border-transparent hover:bg-surface-2"
              )}
            >
              <span className="label-mono w-6 shrink-0 pt-0.5 text-right text-faint tabular">{index + 1}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn("truncate text-sm font-medium", isCurrent ? "text-fg" : "text-fg-muted")}>{item.companyName}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  {overdue ? <span className="text-danger">Atrasada {overdue}</span> : <span>{formatDue(item.dueDate)}</span>}
                  {item.callHistory.lastOutcome && (
                    <span>
                      · {item.callHistory.attempts} tent. · {activityOutcomeLabels[item.callHistory.lastOutcome].toLowerCase()}
                    </span>
                  )}
                </span>
              </span>
              {!dialable && <PhoneOff className="mt-0.5 size-3.5 shrink-0 text-faint" aria-label="Sem número discável" />}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
