import { useState } from "react"
import { CalendarClock, Check, Loader2, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { activityTypeIcons } from "@/features/activities/activity-icons"
import { activityTypeLabels } from "@/features/activities/activity-labels"
import { toMessage } from "@/features/companies/form-errors"
import { formatDue, formatOverdue } from "@/lib/format"
import { cancelTask, completeTask, rescheduleTask, type TaskItem } from "./api"
import { taskStatusLabels } from "./task-labels"

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

type Props = {
  task: TaskItem
  overdue: boolean
  /** `quick` = só concluir (dashboard); `full` = concluir, reagendar e cancelar (tela de tarefas). */
  actions?: "quick" | "full"
  showOwner?: boolean
  onOpenDeal: (dealId: string) => void
  onChanged: (updated: TaskItem, original: TaskItem) => void
}

/**
 * Uma próxima ação na fila do SDR. A leitura em um segundo: o que é (ícone + tipo), com
 * quem (empresa, que abre o negócio), quando (e há quanto tempo venceu) e o botão de
 * concluir sempre no mesmo lugar, à direita.
 */
export function TaskListItem({ task, overdue, actions = "full", showOwner = true, onOpenDeal, onChanged }: Props) {
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [newDueDate, setNewDueDate] = useState(() => toLocalInputValue(new Date(task.dueDate)))
  const [busyAction, setBusyAction] = useState<"complete" | "cancel" | "reschedule" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const Icon = activityTypeIcons[task.type]
  const isPending = task.status === "Pendente"
  const overdueLabel = isPending && overdue ? formatOverdue(task.dueDate) : null

  async function run(kind: "complete" | "cancel" | "reschedule", action: () => Promise<TaskItem>) {
    setBusyAction(kind)
    setError(null)
    try {
      const updated = await action()
      setIsRescheduling(false)
      onChanged(updated, task)
    } catch (err) {
      setError(toMessage(err, "Não foi possível atualizar a tarefa."))
    } finally {
      setBusyAction(null)
    }
  }

  const isBusy = busyAction !== null

  return (
    <li className="group/task @container px-4 py-3.5 transition-colors hover:bg-surface-2/50 sm:px-5">
      <div className="flex items-start gap-3.5">
        <span
          className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-sm border border-line-soft bg-surface-2 text-fg-muted"
          aria-hidden="true"
        >
          <Icon className="size-3.5" />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1 @lg:flex-row @lg:items-start @lg:gap-6">
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <button
                type="button"
                onClick={() => onOpenDeal(task.dealId)}
                className="max-w-full cursor-pointer truncate rounded-xs text-left text-base font-medium text-fg decoration-line-strong underline-offset-4 hover:underline focus-visible:focus-ring"
              >
                {task.companyName}
              </button>
              <span className="label-mono text-muted">{activityTypeLabels[task.type]}</span>
            </p>
            {task.note && <p className="mt-0.5 line-clamp-2 text-sm text-fg-muted">{task.note}</p>}
            {showOwner && <p className="mt-0.5 truncate text-xs text-muted">{task.ownerUserName}</p>}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-sm @lg:w-36 @lg:flex-col @lg:items-end">
            <span className="text-fg-muted tabular">{formatDue(task.dueDate)}</span>
            {overdueLabel && (
              <span className="flex items-center gap-1.5 text-xs text-danger">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-danger" />
                Atrasada {overdueLabel}
              </span>
            )}
            {!isPending && (
              <Badge variant={task.status === "Concluida" ? "success" : "outline"}>{taskStatusLabels[task.status]}</Badge>
            )}
          </div>
        </div>

        {isPending && (
          <div className="flex shrink-0 items-center gap-1">
            {actions === "full" && (
              <>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Reagendar tarefa de ${task.companyName}`}
                  aria-expanded={isRescheduling}
                  title="Reagendar"
                  disabled={isBusy}
                  onClick={() => setIsRescheduling((v) => !v)}
                >
                  <CalendarClock aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Cancelar tarefa de ${task.companyName}`}
                  title="Cancelar tarefa"
                  disabled={isBusy}
                  onClick={() => run("cancel", () => cancelTask(task.id))}
                >
                  {busyAction === "cancel" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />}
                </Button>
              </>
            )}
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label={`Concluir tarefa de ${task.companyName}`}
              title="Concluir"
              disabled={isBusy}
              onClick={() => run("complete", () => completeTask(task.id))}
              className="hover:border-success hover:bg-success/10 hover:text-success"
            >
              {busyAction === "complete" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
            </Button>
          </div>
        )}
      </div>

      {isPending && isRescheduling && (
        <div className="mt-3 ml-11.5 flex flex-wrap items-center gap-2">
          <Input
            type="datetime-local"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            className="h-9 w-auto"
            aria-label="Nova data da tarefa"
          />
          <Button
            type="button"
            size="sm"
            disabled={isBusy}
            onClick={() => run("reschedule", () => rescheduleTask(task.id, new Date(newDueDate).toISOString()))}
          >
            {busyAction === "reschedule" && <Loader2 className="animate-spin" aria-hidden="true" />}
            Reagendar
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={isBusy} onClick={() => setIsRescheduling(false)}>
            Cancelar
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 ml-11.5 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </li>
  )
}
