import { History } from "lucide-react"

import type { StageChange, UserSummary } from "./api"
import { stageLabels } from "./stage-labels"

type Props = {
  history: StageChange[]
  users: UserSummary[]
}

/** Histórico de estágios do negócio — de→para, com data e autor (regra 4.2 do CLAUDE.md). */
export function StageHistory({ history, users }: Props) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem histórico de estágios ainda.</p>
  }

  const userName = (userId: string) => users.find((u) => u.id === userId)?.name ?? "Alguém"

  return (
    <ol className="flex flex-col gap-3">
      {[...history].reverse().map((change) => (
        <li key={change.id} className="flex gap-3">
          <History className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground">
              {change.fromStage ? (
                <>
                  <span className="text-muted-foreground">{stageLabels[change.fromStage]}</span>
                  {" → "}
                  <span className="font-medium">{stageLabels[change.toStage]}</span>
                </>
              ) : (
                <>
                  Negócio criado em <span className="font-medium">{stageLabels[change.toStage]}</span>
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(change.changedAt).toLocaleString("pt-BR")} · {userName(change.changedByUserId)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
