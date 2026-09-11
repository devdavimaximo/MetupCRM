import { CalendarClock, MessageCircle, Phone, StickyNote, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { Activity, ActivityType } from "./api"
import { activityOutcomeLabels, activityTypeLabels } from "./activity-labels"

const typeIcons: Record<ActivityType, typeof Phone> = {
  Call: Phone,
  WhatsApp: MessageCircle,
  Meeting: Users,
  Proposal: CalendarClock,
  Note: StickyNote,
}

type Props = {
  activities: Activity[]
}

/** Timeline do negócio — toda interação registrada, mais recente primeiro (seção 4.3 do CLAUDE.md). */
export function ActivityTimeline({ activities }: Props) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
  }

  return (
    <ol className="flex flex-col gap-3">
      {activities.map((activity) => {
        const Icon = typeIcons[activity.type]
        return (
          <li key={activity.id} className="flex gap-3">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-medium text-foreground">{activityTypeLabels[activity.type]}</p>
                {activity.outcome && <Badge variant="outline">{activityOutcomeLabels[activity.outcome]}</Badge>}
                {activity.contactName && (
                  <span className="text-xs text-muted-foreground">com {activity.contactName}</span>
                )}
              </div>
              {activity.note && <p className="text-sm text-foreground/90">{activity.note}</p>}
              <p className="text-xs text-muted-foreground">
                {new Date(activity.occurredAt).toLocaleString("pt-BR")} · {activity.authorUserName}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
