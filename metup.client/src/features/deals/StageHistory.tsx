import { ArrowRight } from "lucide-react"

import { formatDateTime } from "@/lib/format"
import type { StageChange, UserSummary } from "./api"
import { stageLabels } from "./stage-labels"

type Props = {
  history: StageChange[]
  users: UserSummary[]
}

/** Histórico de estágios do negócio — de→para, com data e autor (regra 4.2 do CLAUDE.md). */
export function StageHistory({ history, users }: Props) {
  if (history.length === 0) {
    return <p className="text-sm text-muted">Sem histórico de estágios ainda.</p>
  }

  const userName = (userId: string) => users.find((u) => u.id === userId)?.name ?? "Alguém"

  return (
    <ol className="flex flex-col">
      {[...history].reverse().map((change, index, list) => (
        <li key={change.id} className="relative flex gap-3.5 pb-4 last:pb-0">
          {index < list.length - 1 && (
            <span aria-hidden="true" className="absolute top-3 bottom-0 left-[0.21875rem] w-px bg-line-soft" />
          )}
          <span
            aria-hidden="true"
            className={index === 0 ? "relative mt-1.5 size-2 shrink-0 bg-accent" : "relative mt-1.5 size-2 shrink-0 border border-line-strong bg-surface"}
          />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-base text-fg">
              {change.fromStage ? (
                <>
                  <span className="text-muted">{stageLabels[change.fromStage]}</span>
                  <ArrowRight className="size-3 text-faint" aria-label="para" />
                  <span className="font-medium">{stageLabels[change.toStage]}</span>
                </>
              ) : (
                <>
                  Criado em <span className="font-medium">{stageLabels[change.toStage]}</span>
                </>
              )}
            </p>
            <p className="text-xs text-muted">
              <span className="tabular">{formatDateTime(change.changedAt)}</span> · {userName(change.changedByUserId)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
