import { useState } from "react"
import { BadgeCheck, Check, CircleX, Loader2, TrendingUp, UserPlus, type LucideIcon } from "lucide-react"

import { activityTypeIcons } from "@/features/activities/activity-icons"
import { activityOutcomeLabels, activityTypeLabels } from "@/features/activities/activity-labels"
import { stageLabels } from "@/features/deals/stage-labels"
import { toMessage } from "@/features/companies/form-errors"
import { completeTask, type TaskItem } from "@/features/tasks/api"
import { formatDue, formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { RecentEvent } from "./api"
import { formatMoneyWhole } from "./dashboard-format"
import { Panel, SeeAll } from "./dashboard-cards"

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

/** Coluna de ação: o que aconteceu na operação e o que o usuário precisa fazer a seguir. */
export function SideColumn({
  events,
  tasks,
  overdueCount,
  onOpenDeal,
  onSeeTasks,
  onTaskCompleted,
}: {
  events: RecentEvent[]
  tasks: TaskItem[] | null
  overdueCount: number
  onOpenDeal: (dealId: string) => void
  onSeeTasks: () => void
  onTaskCompleted: (task: TaskItem) => void
}) {
  return (
    <Panel className="overflow-hidden">
      <section aria-labelledby="recent-heading" className="flex min-h-0 flex-col px-5 pt-5 pb-2">
        <header className="mb-3 flex items-center justify-between gap-3">
          <h2 id="recent-heading" className="text-md font-medium text-fg">
            Atividade Recente
          </h2>
        </header>
        {events.length === 0 ? (
          <p className="py-6 text-sm text-muted">Ligações, mudanças de etapa e fechamentos aparecem aqui.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-line-soft/70">
            {events.map((event, index) => {
              const { icon: Icon, title, tone } = describe(event)
              return (
                <li key={`${event.dealId}-${event.occurredAt}-${index}`}>
                  <button
                    type="button"
                    onClick={() => onOpenDeal(event.dealId)}
                    className="flex w-full cursor-pointer items-start gap-3 rounded-sm py-2.5 text-left transition-colors hover:bg-surface-3/30 focus-visible:focus-ring"
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
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <div className="mx-5 border-t border-line-soft" />

      <section aria-labelledby="tasks-heading" className="flex min-h-0 flex-1 flex-col px-5 pt-4 pb-4">
        <header className="mb-2 flex items-center justify-between gap-3">
          <h2 id="tasks-heading" className="text-md font-medium text-fg">
            Próximas Tarefas
          </h2>
          <SeeAll onClick={onSeeTasks} />
        </header>

        {overdueCount > 0 && (
          <button
            type="button"
            onClick={onSeeTasks}
            className="mb-2 flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-left text-sm transition-colors hover:bg-danger/15 focus-visible:focus-ring"
          >
            <span className="text-fg">
              <strong className="font-semibold text-danger tabular">{overdueCount}</strong>{" "}
              {overdueCount === 1 ? "follow-up atrasado" : "follow-ups atrasados"}
            </span>
            <span className="text-xs text-danger">Resolver</span>
          </button>
        )}

        {tasks === null ? (
          <p className="py-4 text-sm text-muted">Carregando…</p>
        ) : tasks.length === 0 ? (
          <p className="py-4 text-sm text-muted">Nenhuma tarefa pendente. Bom momento para prospectar.</p>
        ) : (
          <ul className="flex min-h-0 flex-col divide-y divide-line-soft/70 overflow-y-auto">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} onOpenDeal={onOpenDeal} onCompleted={onTaskCompleted} />
            ))}
          </ul>
        )}
      </section>
    </Panel>
  )
}

function TaskRow({
  task,
  onOpenDeal,
  onCompleted,
}: {
  task: TaskItem
  onOpenDeal: (dealId: string) => void
  onCompleted: (task: TaskItem) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const overdue = new Date(task.dueDate) < new Date()

  async function complete() {
    setBusy(true)
    setError(null)
    try {
      await completeTask(task.id)
      onCompleted(task)
    } catch (err) {
      setError(toMessage(err, "Não foi possível concluir."))
      setBusy(false)
    }
  }

  return (
    <li className="flex items-start gap-3 py-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={false}
        aria-label={`Concluir ${activityTypeLabels[task.type]} com ${task.companyName}`}
        disabled={busy}
        onClick={complete}
        className="mt-0.5 inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-xs border border-line-strong text-transparent transition-colors hover:border-success hover:text-success focus-visible:focus-ring disabled:cursor-wait"
      >
        {busy ? <Loader2 className="size-3 animate-spin text-muted" aria-hidden="true" /> : <Check className="size-3" aria-hidden="true" />}
      </button>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onOpenDeal(task.dealId)}
          className="block max-w-full cursor-pointer truncate rounded-xs text-left text-sm text-fg hover:underline focus-visible:focus-ring"
        >
          {activityTypeLabels[task.type]} - {task.companyName}
        </button>
        <p className={cn("text-xs tabular", overdue ? "text-danger" : "text-muted")}>{formatDue(task.dueDate).replace(", ", " • ")}</p>
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      </div>
      <span className="shrink-0 rounded-sm bg-surface-3 px-2 py-0.5 text-2xs text-fg-muted">{activityTypeLabels[task.type]}</span>
    </li>
  )
}
