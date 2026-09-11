import { Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
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

export function DealCard({ deal, isMoving, onOpen, onMoveStage }: Props) {
  const isOpen = deal.status === "Aberto"
  const value = deal.amount ?? deal.ticket

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-sm">
      <button type="button" onClick={onOpen} className="flex flex-col gap-1 rounded-sm text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <span className="truncate text-sm font-medium text-foreground">{deal.companyName}</span>
        <span className="truncate text-xs text-muted-foreground">
          {deal.contactName ?? "Sem contato definido"}
        </span>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant={deal.status === "Ganho" ? "success" : "outline"} className="tabular">
            {formatMoney(value)}
          </Badge>
          <Badge variant="outline">{sourceLabels[deal.source]}</Badge>
        </div>

        <span className="truncate text-xs text-muted-foreground">{deal.ownerUserName}</span>
      </button>

      {isOpen && (
        <div className="flex items-center gap-1.5 border-t border-border pt-2">
          <label htmlFor={`stage-${deal.id}`} className="sr-only">
            Mover {deal.companyName} para outro estágio
          </label>
          <Select
            id={`stage-${deal.id}`}
            value={deal.stage}
            disabled={isMoving}
            onChange={(e) => onMoveStage(e.target.value as DealStage)}
            className={cn("h-8 text-xs", isMoving && "opacity-60")}
          >
            {ACTIVE_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stageLabels[stage]}
              </option>
            ))}
          </Select>
          {isMoving && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />}
        </div>
      )}

      {!isOpen && deal.closedAt && (
        <p className="border-t border-border pt-2 text-xs text-muted-foreground">
          Fechado em {new Date(deal.closedAt).toLocaleDateString("pt-BR")}
        </p>
      )}
    </div>
  )
}
