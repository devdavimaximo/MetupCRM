import { BadgeCheck, CircleX, TrendingUp, UserPlus, type LucideIcon } from "lucide-react"

import { activityTypeIcons } from "@/features/activities/activity-icons"
import { activityOutcomeLabels, activityTypeLabels } from "@/features/activities/activity-labels"
import { stageLabels } from "@/features/deals/stage-labels"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { RecentEvent } from "./api"
import { formatMoneyWhole } from "./dashboard-format"

function describe(event: RecentEvent): { icon: LucideIcon; title: string; tone?: "success" | "danger" } {
  switch (event.kind) {
    case "DealCreated":
      return { icon: UserPlus, title: "Novo negócio cadastrado" }
    case "StageAdvanced":
      return { icon: TrendingUp, title: `Avançou para ${event.toStage ? stageLabels[event.toStage] : "outra etapa"}` }
    case "DealWon":
      return {
        icon: BadgeCheck,
        title: event.amount !== null ? `Negócio fechado · ${formatMoneyWhole(event.amount)}` : "Negócio fechado",
        tone: "success",
      }
    case "DealLost":
      return { icon: CircleX, title: "Negócio perdido", tone: "danger" }
    case "Activity": {
      const type = event.activityType ?? "Note"
      const outcome = event.outcome ? ` · ${activityOutcomeLabels[event.outcome]}` : ""
      return { icon: activityTypeIcons[type], title: `${activityTypeLabels[type]} registrada${outcome}` }
    }
  }
}

function relativeLabel(iso: string) {
  const short = formatRelative(iso)
  if (short === "agora") return "agora"
  return /^\d/.test(short) ? `há ${short.replace("min", "minutos")}` : short
}

/**
 * Uma linha do feed da operação — a mesma na Atividade Recente e no "Ver todas". O botão inteiro abre
 * o negócio.
 */
export function ActivityEventButton({
  event,
  onOpenDeal,
  highlight = false,
}: {
  event: RecentEvent
  onOpenDeal: (dealId: string) => void
  /** Chegou agora em tempo real: fundo dourado que some sozinho (transição de cor, sem movimento). */
  highlight?: boolean
}) {
  const { icon: Icon, title, tone } = describe(event)
  return (
    <button
      type="button"
      onClick={() => onOpenDeal(event.dealId)}
      data-highlight={highlight || undefined}
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 rounded-sm py-2.5 text-left transition-colors duration-700 hover:bg-surface-3/30 focus-visible:focus-ring",
        highlight && "bg-accent/12"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line-soft bg-surface-3/70",
          tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-fg-muted"
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm text-fg">{title}</span>
        <span className="truncate text-xs text-fg-muted">{event.companyName}</span>
        <span className="truncate text-xs text-muted">
          {relativeLabel(event.occurredAt)} · {event.actorName}
        </span>
      </span>
    </button>
  )
}
