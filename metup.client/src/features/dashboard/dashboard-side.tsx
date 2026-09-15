import { useEffect, useRef, useState, type Ref } from "react"
import { Check, CircleAlert, Loader2, RotateCw } from "lucide-react"

import { activityTypeLabels } from "@/features/activities/activity-labels"
import { toMessage } from "@/features/companies/form-errors"
import { completeTask, type TaskItem } from "@/features/tasks/api"
import { formatDue } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { RecentEvent } from "./api"
import { ActivityEventButton } from "./activity-event"
import { Panel, SeeAll } from "./dashboard-cards"

/** Saída da linha concluída; com movimento reduzido, a linha só some. */
const TASK_EXIT_MS = 200

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Coluna de ação: o que aconteceu na operação e o que o usuário precisa fazer a seguir.
 * `events` é `null` quando o panorama não carregou; `tasksError` só afeta o bloco de tarefas.
 */
export function SideColumn({
  events,
  tasks,
  overdueCount,
  tasksError,
  onRetryTasks,
  onOpenDeal,
  onSeeTasks,
  onSeeAllActivity,
  seeAllActivityRef,
  onTaskCompleted,
  highlightedEventIds,
}: {
  events: RecentEvent[] | null
  tasks: TaskItem[] | null
  overdueCount: number
  tasksError: string | null
  onRetryTasks: () => void
  onOpenDeal: (dealId: string) => void
  onSeeTasks: () => void
  onSeeAllActivity: () => void
  /** O "Ver todas" da atividade: o sheet devolve o foco para ele ao fechar. */
  seeAllActivityRef?: Ref<HTMLButtonElement>
  onTaskCompleted: (task: TaskItem) => void
  /** Eventos que acabaram de chegar em tempo real: realce breve. */
  highlightedEventIds?: ReadonlySet<string>
}) {
  return (
    <Panel className="overflow-hidden">
      <section aria-labelledby="recent-heading" className="flex min-h-0 flex-col px-5 pt-5 pb-2">
        <header className="mb-3 flex items-center justify-between gap-3">
          <h2 id="recent-heading" className="text-md font-medium text-fg">
            Atividade Recente
          </h2>
          <SeeAll ref={seeAllActivityRef} onClick={onSeeAllActivity} />
        </header>
        {events === null ? (
          <p className="py-6 text-sm text-muted">Indisponível enquanto o panorama não carrega.</p>
        ) : events.length === 0 ? (
          <p className="py-6 text-sm text-muted">Ligações, mudanças de etapa e fechamentos aparecem aqui.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-line-soft/70">
            {events.map((event) => (
              <li key={event.id}>
                <ActivityEventButton event={event} onOpenDeal={onOpenDeal} highlight={highlightedEventIds?.has(event.id)} />
              </li>
            ))}
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

        {tasksError && (
          <div role="alert" className="mb-2 flex items-center justify-between gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-fg">
            <span className="flex min-w-0 items-center gap-1.5">
              <CircleAlert className="size-3.5 shrink-0 text-danger" aria-hidden="true" />
              <span className="truncate">{tasksError}</span>
            </span>
            <button
              type="button"
              onClick={onRetryTasks}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xs text-danger hover:text-fg focus-visible:focus-ring"
            >
              <RotateCw className="size-3" aria-hidden="true" />
              Tentar de novo
            </button>
          </div>
        )}

        {tasks === null ? (
          !tasksError && <p className="py-4 text-sm text-muted">Carregando…</p>
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
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const exitTimer = useRef<number | undefined>(undefined)
  const overdue = new Date(task.dueDate) < new Date()

  useEffect(() => () => window.clearTimeout(exitTimer.current), [])

  async function complete() {
    setBusy(true)
    setError(null)
    try {
      await completeTask(task.id)
    } catch (err) {
      setError(toMessage(err, "Não foi possível concluir."))
      setBusy(false)
      return
    }
    // A linha sai primeiro; só depois o painel pede a fila nova ao servidor.
    setLeaving(true)
    exitTimer.current = window.setTimeout(() => onCompleted(task), prefersReducedMotion() ? 0 : TASK_EXIT_MS)
  }

  return (
    <li
      aria-hidden={leaving || undefined}
      className={cn(
        "flex items-start gap-3 py-2.5 transition-[opacity,translate] duration-200 ease-out",
        leaving && "pointer-events-none translate-x-2 opacity-0 motion-reduce:translate-x-0"
      )}
    >
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
