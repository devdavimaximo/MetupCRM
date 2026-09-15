import { useCallback, useEffect, useState } from "react"
import { CheckCheck, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Page, PageHeader } from "@/components/ui/page"
import { SegmentedControl } from "@/components/ui/segmented"
import { Select } from "@/components/ui/select"
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/states"
import { toMessage } from "@/features/companies/form-errors"
import { listUsers, type UserSummary } from "@/features/deals/api"
import type { AuthenticatedUser } from "@/lib/auth"
import { pluralize } from "@/lib/format"
import { readUrlState, writeUrlState } from "@/lib/url-state"
import { cn } from "@/lib/utils"
import { TaskListItem } from "./TaskListItem"
import { listTasks, type TaskItem, type TaskStatus } from "./api"

type Props = {
  role: AuthenticatedUser["role"]
  onOpenDeal: (dealId: string) => void
}

/** Data local (YYYY-MM-DD) do input type="date" convertida para o início/fim do dia em ISO. */
function toIsoDayStart(date: string): string | undefined {
  return date ? new Date(`${date}T00:00:00`).toISOString() : undefined
}

function toIsoDayEnd(date: string): string | undefined {
  return date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined
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
  upcoming: "Próximas",
}

const historyBucketLabels: Record<Bucket, string> = {
  overdue: "Prazo passado",
  today: "Prazo hoje",
  upcoming: "Prazo futuro",
}

type StatusFilter =Extract<TaskStatus, "Pendente" | "Concluida">

/** "Hoje você tem N contatos que precisam de follow-up" (seção 3.5 do CLAUDE.md). */
export function TasksPage({ role, onOpenDeal }: Props) {
  const initialUrlState = readUrlState()
  const canFilterByOwner = role === "Admin" || role === "Closer"

  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    initialUrlState.taskStatus === "Concluida" ? "Concluida" : "Pendente"
  )
  const [ownerUserId, setOwnerUserId] = useState(canFilterByOwner ? initialUrlState.ownerUserId : "")
  const [dueFrom, setDueFrom] = useState(initialUrlState.dueFrom)
  const [dueTo, setDueTo] = useState(initialUrlState.dueTo)
  const [users, setUsers] = useState<UserSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)

  const reload = useCallback(() => setReloadVersion((v) => v + 1), [])

  useEffect(() => {
    if (!canFilterByOwner) return
    const controller = new AbortController()
    listUsers(controller.signal)
      .then(setUsers)
      .catch(() => undefined)
    return () => controller.abort()
  }, [canFilterByOwner])

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    listTasks(
      {
        status: statusFilter === "Pendente" ? "Pendente" : undefined,
        ownerUserId: ownerUserId || undefined,
        dueFrom: toIsoDayStart(dueFrom),
        dueTo: toIsoDayEnd(dueTo),
        pageSize: 200,
      },
      controller.signal
    )
      .then((result) => setTasks(result.items))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(toMessage(err, "Não foi possível carregar as tarefas."))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [statusFilter, ownerUserId, dueFrom, dueTo, reloadVersion])

  useEffect(() => {
    writeUrlState({
      taskStatus: statusFilter === "Pendente" ? "" : statusFilter,
      ownerUserId,
      dueFrom,
      dueTo,
    })
  }, [statusFilter, ownerUserId, dueFrom, dueTo])

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

  const hasExtraFilters = Boolean(ownerUserId || dueFrom || dueTo)
  const ownerName = users.find((u) => u.id === ownerUserId)?.name
  const showOwner = canFilterByOwner && Boolean(ownerUserId)

  return (
    <Page width="narrow" className="max-w-4xl">
      <PageHeader
        eyebrow="Operação"
        title={ownerName ? `Tarefas de ${ownerName.split(" ")[0]}` : "Minhas tarefas"}
        description={
          isLoading
            ? "Carregando a fila…"
            : statusFilter === "Pendente"
              ? `${pluralize(tasks.length, "próxima ação pendente", "próximas ações pendentes")}. Conclua, reagende ou cancele sem sair da lista.`
              : `${pluralize(tasks.length, "tarefa", "tarefas")} no histórico, incluindo concluídas e canceladas.`
        }
        actions={
          <SegmentedControl<StatusFilter>
            label="Status das tarefas"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "Pendente", label: "Pendentes" },
              { value: "Concluida", label: "Concluídas" },
            ]}
          />
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          {canFilterByOwner && (
            <div className="flex w-full flex-col gap-2 sm:w-52">
              <Label htmlFor="tasks-filter-owner">Responsável</Label>
              <Select id="tasks-filter-owner" value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} className="h-9">
                <option value="">Minhas tarefas</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="tasks-filter-due-from">Prazo de</Label>
            <Input
              id="tasks-filter-due-from"
              type="date"
              className="h-9 w-40"
              value={dueFrom}
              max={dueTo || undefined}
              onChange={(e) => setDueFrom(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tasks-filter-due-to">Até</Label>
            <Input
              id="tasks-filter-due-to"
              type="date"
              className="h-9 w-40"
              value={dueTo}
              min={dueFrom || undefined}
              onChange={(e) => setDueTo(e.target.value)}
            />
          </div>

          {hasExtraFilters && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9"
              onClick={() => {
                setOwnerUserId("")
                setDueFrom("")
                setDueTo("")
              }}
            >
              <X aria-hidden="true" />
              Limpar filtros
            </Button>
          )}
        </div>

        {error && <Alert onRetry={reload}>{error}</Alert>}

        {!error && (
          <Card className="overflow-clip">
            {isLoading && tasks.length === 0 && <SkeletonRows rows={6} label="Carregando tarefas…" />}

            {!isLoading && tasks.length === 0 && (
              <EmptyState
                icon={CheckCheck}
                title={statusFilter === "Pendente" ? "Nenhum follow-up pendente" : "Nenhuma tarefa concluída"}
                description={
                  hasExtraFilters
                    ? "Nada encontrado com esses filtros. Ajuste o período ou o responsável."
                    : statusFilter === "Pendente"
                      ? "A fila está em dia. Novas próximas ações aparecem aqui quando você registra uma atividade."
                      : "Tarefas concluídas aparecem aqui assim que você marca uma próxima ação como feita."
                }
                action={
                  hasExtraFilters ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setOwnerUserId("")
                        setDueFrom("")
                        setDueTo("")
                      }}
                    >
                      Limpar filtros
                    </Button>
                  ) : undefined
                }
              />
            )}

            {tasks.length > 0 &&
              grouped.map(({ bucket, items }) =>
                items.length === 0 ? null : (
                  <section key={bucket} aria-labelledby={`tasks-${bucket}-heading`} className={cn(isLoading && "opacity-60")}>
                    <h2
                      id={`tasks-${bucket}-heading`}
                      className={cn(
                        "label-mono sticky top-14 z-10 flex items-center justify-between border-y border-line-soft/60 bg-surface px-4 py-2 first:border-t-0 sm:px-5 lg:top-0",
                        bucket === "overdue" && statusFilter === "Pendente" ? "text-danger" : "text-fg-muted"
                      )}
                    >
                      {statusFilter === "Pendente" ? bucketLabels[bucket] : historyBucketLabels[bucket]}
                      <span className="text-muted tabular">{items.length}</span>
                    </h2>
                    <ul className="divide-y divide-line-soft/60">
                      {items.map((task) => (
                        <TaskListItem
                          key={task.id}
                          task={task}
                          overdue={bucket === "overdue"}
                          showOwner={showOwner}
                          onOpenDeal={onOpenDeal}
                          onChanged={handleChanged}
                        />
                      ))}
                    </ul>
                  </section>
                )
              )}
          </Card>
        )}
      </div>
    </Page>
  )
}
