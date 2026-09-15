import { ListTree } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/states"
import { formatDateTime } from "@/lib/format"
import { activityTypeIcons } from "./activity-icons"
import type { Activity, ActivityOutcome } from "./api"
import { activityOutcomeLabels, activityTypeLabels } from "./activity-labels"

type Props = {
  activities: Activity[]
}

/** Desfechos que movem o negócio para frente ganham acento; os que encerram, perigo. */
function outcomeVariant(outcome: ActivityOutcome): "accent" | "danger" | "default" {
  if (outcome === "Interessado" || outcome === "ReuniaoAgendada") return "accent"
  if (outcome === "SemInteresse" || outcome === "NumeroInvalido") return "danger"
  return "default"
}

/** Timeline do negócio — toda interação registrada, mais recente primeiro (seção 4.3 do CLAUDE.md). */
export function ActivityTimeline({ activities }: Props) {
  if (activities.length === 0) {
    return (
      <EmptyState
        compact
        icon={ListTree}
        title="Nenhuma atividade ainda"
        description="Registre a primeira ligação ou mensagem — ela aparece aqui com o desfecho."
      />
    )
  }

  return (
    <ol className="relative flex flex-col">
      {activities.map((activity, index) => {
        const Icon = activityTypeIcons[activity.type]
        const isLast = index === activities.length - 1
        return (
          <li key={activity.id} className="relative flex gap-3.5 pb-5 last:pb-0">
            {!isLast && <span aria-hidden="true" className="absolute top-8 bottom-0 left-3.75 w-px bg-line-soft" />}
            <span
              aria-hidden="true"
              className="relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-sm border border-line-soft bg-surface-2 text-fg-muted"
            >
              <Icon className="size-3.5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-base font-medium text-fg">{activityTypeLabels[activity.type]}</p>
                {activity.outcome && (
                  <Badge variant={outcomeVariant(activity.outcome)}>{activityOutcomeLabels[activity.outcome]}</Badge>
                )}
                {activity.contactName && <span className="text-sm text-muted">com {activity.contactName}</span>}
              </div>
              {activity.note && <p className="text-sm text-fg-muted">{activity.note}</p>}
              <p className="text-xs text-muted">
                <span className="tabular">{formatDateTime(activity.occurredAt)}</span> · {activity.authorUserName}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
