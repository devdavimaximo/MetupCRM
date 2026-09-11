import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Briefcase, Building2, CalendarClock, Check, ClipboardList, Loader2, type LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { activityTypeLabels } from "@/features/activities/activity-labels"
import { toMessage } from "@/features/companies/form-errors"
import { stageLabels } from "@/features/deals/stage-labels"
import { completeTask, type TaskItem } from "@/features/tasks/api"
import { cn } from "@/lib/utils"
import { getDashboardSummary, type DashboardSummary } from "./api"

type Props = {
  onOpenDeal: (dealId: string) => void
}

type Bucket = "overdue" | "today"

function bucketOf(task: TaskItem): Bucket {
  return new Date(task.dueDate) < new Date() ? "overdue" : "today"
}

const bucketLabels: Record<Bucket, string> = {
  overdue: "Atrasadas",
  today: "Hoje",
}

/** A tela-mãe (seção 3.1 do CLAUDE.md): quanto trabalho comercial tem hoje e onde estão as oportunidades. */
export function DashboardPage({ onOpenDeal }: Props) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)

  const reload = useCallback(() => setReloadVersion((v) => v + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    getDashboardSummary(controller.signal)
      .then(setSummary)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(toMessage(err, "Não foi possível carregar o dashboard."))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [reloadVersion])

  function handleTaskCompleted(task: TaskItem) {
    const bucket = bucketOf(task)
    setSummary((current) =>
      current
        ? {
            ...current,
            todayTasks: current.todayTasks.filter((t) => t.id !== task.id),
            taskCounts: {
              ...current.taskCounts,
              overdue: bucket === "overdue" ? current.taskCounts.overdue - 1 : current.taskCounts.overdue,
              today: bucket === "today" ? current.taskCounts.today - 1 : current.taskCounts.today,
            },
          }
        : current
    )
  }

  const buckets: Bucket[] = ["overdue", "today"]
  const grouped = summary
    ? buckets.map((bucket) => ({
        bucket,
        items: summary.todayTasks.filter((t) => bucketOf(t) === bucket),
      }))
    : []

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Quanto trabalho comercial você tem hoje e onde estão as oportunidades.</p>
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <Button type="button" size="sm" variant="outline" onClick={reload}>
            Tentar de Novo
          </Button>
        </div>
      )}

      {isLoading && !summary && !error && (
        <p className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Carregando dashboard…
        </p>
      )}

      {summary && (
        <>
          <section aria-label="Resumo de hoje" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Follow-ups atrasados"
              value={summary.taskCounts.overdue}
              icon={AlertCircle}
              tone="destructive"
            />
            <StatCard label="Follow-ups hoje" value={summary.taskCounts.today} icon={CalendarClock} />
            <StatCard label="Negócios abertos" value={summary.openDealsTotal} icon={Briefcase}>
              {summary.openDealsByStage.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {summary.openDealsByStage.map((d) => (
                    <Badge key={d.stage} variant="outline">
                      {stageLabels[d.stage]} <span className="font-normal">({d.count})</span>
                    </Badge>
                  ))}
                </div>
              )}
            </StatCard>
            <StatCard label="Atividades registradas hoje" value={summary.activitiesTodayTotal} icon={ClipboardList}>
              {summary.activitiesToday.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {summary.activitiesToday.map((a) => (
                    <Badge key={a.type} variant="outline">
                      {activityTypeLabels[a.type]} <span className="font-normal">({a.count})</span>
                    </Badge>
                  ))}
                </div>
              )}
            </StatCard>
          </section>

          <section aria-labelledby="quick-tasks-heading" className="flex flex-col gap-3">
            <h2 id="quick-tasks-heading" className="text-sm font-semibold text-foreground">
              Follow-ups de hoje e atrasados
            </h2>

            {summary.todayTasks.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum follow-up pendente para hoje. 🎉</p>
            ) : (
              <div aria-live="polite" className="flex flex-col gap-3">
                {grouped.map(({ bucket, items }) =>
                  items.length === 0 ? null : (
                    <div key={bucket} className="flex flex-col gap-2">
                      <h3 className="text-xs font-semibold text-muted-foreground">
                        {bucketLabels[bucket]} <span className="font-normal">({items.length})</span>
                      </h3>
                      <ul className="flex flex-col gap-2">
                        {items.map((task) => (
                          <TaskQuickRow
                            key={task.id}
                            task={task}
                            overdue={bucket === "overdue"}
                            onOpenDeal={onOpenDeal}
                            onCompleted={handleTaskCompleted}
                          />
                        ))}
                      </ul>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  children,
}: {
  label: string
  value: number
  icon: LucideIcon
  tone?: "default" | "destructive"
  children?: React.ReactNode
}) {
  const isAlert = tone === "destructive" && value > 0

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className={cn("size-4", isAlert && "text-destructive")} aria-hidden="true" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className={cn("text-2xl font-semibold tabular-nums", isAlert ? "text-destructive" : "text-foreground")}>{value}</p>
        {children}
      </CardContent>
    </Card>
  )
}

function TaskQuickRow({
  task,
  overdue,
  onOpenDeal,
  onCompleted,
}: {
  task: TaskItem
  overdue: boolean
  onOpenDeal: (dealId: string) => void
  onCompleted: (task: TaskItem) => void
}) {
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleComplete() {
    setIsBusy(true)
    setError(null)
    try {
      await completeTask(task.id)
      onCompleted(task)
    } catch (err) {
      setError(toMessage(err, "Não foi possível concluir a tarefa."))
      setIsBusy(false)
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-medium text-foreground">{activityTypeLabels[task.type]}</p>
            {overdue && (
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

        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Concluir tarefa"
          disabled={isBusy}
          onClick={handleComplete}
        >
          {isBusy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </li>
  )
}
