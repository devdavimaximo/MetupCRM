import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Building2, CalendarClock, Check, Loader2, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { activityTypeLabels } from "@/features/activities/activity-labels"
import { toMessage } from "@/features/companies/form-errors"
import { cancelTask, completeTask, listTasks, rescheduleTask, type TaskItem, type TaskStatus } from "./api"

type Props = {
  onOpenDeal: (dealId: string) => void
}

type Bucket = "overdue" | "today" | "upcoming"

function bucketOf(task: TaskItem): Bucket {
  const due = new Date(task.dueDate)
  const now = new Date()
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  if (due < now) return "overdue"
  if (due <= endOfToday) return "today"
  return "upcoming"
}

const bucketLabels: Record<Bucket, string> = {
  overdue: "Atrasadas",
  today: "Hoje",
  upcoming: "Futuras",
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** "Hoje você tem N contatos que precisam de follow-up" (seção 3.5 do CLAUDE.md) — versão simples, sem dashboard ainda. */
export function TasksPage({ onOpenDeal }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "Pendente">("Pendente")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)

  const reload = useCallback(() => setReloadVersion((v) => v + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    listTasks({ status: statusFilter === "Pendente" ? "Pendente" : undefined, pageSize: 200 }, controller.signal)
      .then((result) => setTasks(result.items))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(toMessage(err, "Não foi possível carregar suas tarefas."))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [statusFilter, reloadVersion])

  function handleChanged(updated: TaskItem) {
    setTasks((current) =>
      statusFilter === "Pendente" && updated.status !== "Pendente"
        ? current.filter((t) => t.id !== updated.id)
        : current.map((t) => (t.id === updated.id ? updated : t))
    )
  }

  const buckets: Bucket[] = ["overdue", "today", "upcoming"]
  const grouped = buckets.map((bucket) => ({
    bucket,
    items: tasks.filter((t) => bucketOf(t) === bucket),
  }))

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Minhas tarefas</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Carregando…" : `${tasks.length} ${tasks.length === 1 ? "tarefa" : "tarefas"}`}
          </p>
        </div>

        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={statusFilter === "Pendente" ? "default" : "outline"}
            onClick={() => setStatusFilter("Pendente")}
          >
            Pendentes
          </Button>
          <Button
            type="button"
            size="sm"
            variant={statusFilter === "Concluida" ? "default" : "outline"}
            onClick={() => setStatusFilter("Concluida")}
          >
            Concluídas
          </Button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <Button type="button" size="sm" variant="outline" onClick={reload}>
            Tentar de Novo
          </Button>
        </div>
      )}

      {isLoading && tasks.length === 0 && !error && (
        <p className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Carregando tarefas…
        </p>
      )}

      {!isLoading && !error && tasks.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {statusFilter === "Pendente" ? "Nenhum follow-up pendente. 🎉" : "Nenhuma tarefa concluída ainda."}
        </p>
      )}

      {!error &&
        grouped.map(({ bucket, items }) =>
          items.length === 0 ? null : (
            <section key={bucket} aria-labelledby={`tasks-${bucket}-heading`} className="flex flex-col gap-2">
              <h2 id={`tasks-${bucket}-heading`} className="text-sm font-semibold text-foreground">
                {bucketLabels[bucket]} <span className="font-normal text-muted-foreground">({items.length})</span>
              </h2>
              <ul className="flex flex-col gap-2">
                {items.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    overdue={bucket === "overdue"}
                    onOpenDeal={onOpenDeal}
                    onChanged={handleChanged}
                  />
                ))}
              </ul>
            </section>
          )
        )}
    </div>
  )
}

function TaskRow({
  task,
  overdue,
  onOpenDeal,
  onChanged,
}: {
  task: TaskItem
  overdue: boolean
  onOpenDeal: (dealId: string) => void
  onChanged: (task: TaskItem) => void
}) {
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [newDueDate, setNewDueDate] = useState(() => toLocalInputValue(new Date(task.dueDate)))
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPending = task.status === "Pendente"

  async function run(action: () => Promise<TaskItem>) {
    setIsBusy(true)
    setError(null)
    try {
      const updated = await action()
      onChanged(updated)
      setIsRescheduling(false)
    } catch (err) {
      setError(toMessage(err, "Não foi possível atualizar a tarefa."))
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-medium text-foreground">{activityTypeLabels[task.type]}</p>
            {overdue && isPending && (
              <Badge variant="outline" className="border-destructive/40 text-destructive">
                <AlertCircle className="size-3" aria-hidden="true" />
                Atrasada
              </Badge>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenDeal(task.dealId)}
            className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
          >
            <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
            {task.companyName}
          </button>
          {task.note && <p className="text-sm text-foreground/90">{task.note}</p>}
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
            {new Date(task.dueDate).toLocaleString("pt-BR")} · {task.ownerUserName}
          </p>
        </div>

        {isPending && (
          <div className="flex shrink-0 gap-1.5">
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Concluir tarefa"
              disabled={isBusy}
              onClick={() => run(() => completeTask(task.id))}
            >
              {isBusy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Cancelar tarefa"
              disabled={isBusy}
              onClick={() => run(() => cancelTask(task.id))}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      {isPending && !isRescheduling && (
        <Button type="button" size="sm" variant="link" className="h-auto self-start p-0" onClick={() => setIsRescheduling(true)}>
          Reagendar
        </Button>
      )}

      {isPending && isRescheduling && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="datetime-local"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            className="w-auto"
            aria-label="Nova data da tarefa"
          />
          <Button
            type="button"
            size="sm"
            disabled={isBusy}
            onClick={() => run(() => rescheduleTask(task.id, new Date(newDueDate).toISOString()))}
          >
            {isBusy && <Loader2 className="animate-spin" aria-hidden="true" />}
            Confirmar
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={isBusy} onClick={() => setIsRescheduling(false)}>
            Cancelar
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </li>
  )
}
