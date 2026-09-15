import { useCallback, useEffect, useState, type ReactNode } from "react"
import { ArrowRight, CheckCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Page, PageHeader } from "@/components/ui/page"
import { Alert, EmptyState, Skeleton, SkeletonRows } from "@/components/ui/states"
import { activityTypeIcons } from "@/features/activities/activity-icons"
import { activityTypeLabels } from "@/features/activities/activity-labels"
import { toMessage } from "@/features/companies/form-errors"
import { ACTIVE_STAGES, stageLabels } from "@/features/deals/stage-labels"
import { TaskListItem } from "@/features/tasks/TaskListItem"
import type { TaskItem } from "@/features/tasks/api"
import { formatLongToday, numberFormatter, pluralize } from "@/lib/format"
import type { View } from "@/lib/url-state"
import { cn } from "@/lib/utils"
import { getDashboardSummary, type DashboardSummary } from "./api"

type Props = {
  userName: string
  onOpenDeal: (dealId: string) => void
  onNavigate: (view: View) => void
}

type Bucket = "overdue" | "today"

function bucketOf(task: TaskItem): Bucket {
  return new Date(task.dueDate) < new Date() ? "overdue" : "today"
}

const bucketLabels: Record<Bucket, string> = {
  overdue: "Atrasadas",
  today: "Para hoje",
}

/** Quantas linhas de cada grupo cabem na fila do dashboard; o resto está a um clique, em Tarefas. */
const QUEUE_PREVIEW = 6

function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return "Bom dia"
  if (hour < 18) return "Boa tarde"
  return "Boa noite"
}

/** A tela-mãe (seção 3.1 do CLAUDE.md): quanto trabalho comercial tem hoje e onde estão as oportunidades. */
export function DashboardPage({ userName, onOpenDeal, onNavigate }: Props) {
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

  function handleTaskCompleted(_updated: TaskItem, task: TaskItem) {
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

  const firstName = userName.trim().split(/\s+/)[0] ?? userName

  return (
    <Page>
      <PageHeader
        eyebrow={formatLongToday()}
        title={`${greeting()}, ${firstName}`}
        description={summary ? <SummarySentence summary={summary} /> : "Quanto trabalho comercial você tem hoje e onde estão as oportunidades."}
      />

      {error && <Alert onRetry={reload}>{error}</Alert>}

      {isLoading && !summary && !error && <DashboardSkeleton />}

      {summary && (
        <>
          <section aria-label="Resumo de hoje">
            <Card className="grid grid-cols-2 lg:grid-cols-4">
              <Kpi
                label="Atrasados"
                value={summary.taskCounts.overdue}
                tone={summary.taskCounts.overdue > 0 ? "danger" : "default"}
                caption={summary.taskCounts.overdue > 0 ? "follow-ups vencidos" : "nenhum vencido"}
              />
              <Kpi label="Para hoje" value={summary.taskCounts.today} caption="follow-ups na fila" />
              <Kpi label="Próximos" value={summary.taskCounts.upcoming} caption="agendados à frente" />
              <Kpi
                label="Atividades hoje"
                value={summary.activitiesTodayTotal}
                caption={summary.activitiesTodayTotal > 0 ? "registradas hoje" : "nenhum registro ainda"}
              />
            </Card>
          </section>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
            <FollowUpQueue
              summary={summary}
              onOpenDeal={onOpenDeal}
              onTaskCompleted={handleTaskCompleted}
              onNavigate={onNavigate}
            />

            <div className="flex flex-col gap-6">
              <OpenPipeline summary={summary} onNavigate={onNavigate} />
              <TodayActivities summary={summary} />
            </div>
          </div>
        </>
      )}
    </Page>
  )
}

function SummarySentence({ summary }: { summary: DashboardSummary }) {
  const { overdue, today } = summary.taskCounts

  if (overdue > 0) {
    return (
      <>
        Você tem <strong className="font-semibold text-danger">{pluralize(overdue, "follow-up atrasado", "follow-ups atrasados")}</strong>{" "}
        e {pluralize(today, "para hoje", "para hoje")}. Comece pelos atrasados.
      </>
    )
  }

  if (today > 0) {
    return (
      <>
        Hoje você tem <strong className="font-semibold text-fg">{pluralize(today, "follow-up", "follow-ups")}</strong> na fila.
      </>
    )
  }

  return <>Nenhum follow-up pendente para hoje — bom momento para prospectar.</>
}

function Kpi({
  label,
  value,
  caption,
  tone = "default",
}: {
  label: string
  value: number
  caption: string
  tone?: "default" | "danger"
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-line-soft px-5 py-5 sm:px-6",
        "odd:border-r nth-[-n+2]:border-b lg:border-b-0 lg:not-last:border-r"
      )}
    >
      <p className="label-mono flex items-center gap-2 text-muted">
        {tone === "danger" && <span aria-hidden="true" className="size-1.5 rounded-full bg-danger" />}
        {label}
      </p>
      <p
        className={cn(
          "font-display text-3xl font-semibold tracking-[-0.02em] tabular",
          tone === "danger" ? "text-danger" : "text-fg"
        )}
      >
        {numberFormatter.format(value)}
      </p>
      <p className="text-sm text-muted">{caption}</p>
    </div>
  )
}

function FollowUpQueue({
  summary,
  onOpenDeal,
  onTaskCompleted,
  onNavigate,
}: {
  summary: DashboardSummary
  onOpenDeal: (dealId: string) => void
  onTaskCompleted: (updated: TaskItem, original: TaskItem) => void
  onNavigate: (view: View) => void
}) {
  const buckets: Bucket[] = ["overdue", "today"]
  const grouped = buckets.map((bucket) => ({
    bucket,
    items: summary.todayTasks.filter((t) => bucketOf(t) === bucket),
  }))

  return (
    <Card role="region" aria-labelledby="queue-heading">
      <CardHeader>
        <CardTitle id="queue-heading">Fila de follow-ups</CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={() => onNavigate("tarefas")}>
          Ver todas
          <ArrowRight aria-hidden="true" />
        </Button>
      </CardHeader>

      {summary.todayTasks.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          title="Fila zerada"
          description="Nenhum follow-up vencido ou para hoje. Aproveite para abrir novas conversas."
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("empresas")}>
              Ver empresas
            </Button>
          }
        />
      ) : (
        <div aria-live="polite">
          {grouped.map(({ bucket, items }) =>
            items.length === 0 ? null : (
              <section key={bucket} aria-labelledby={`queue-${bucket}`}>
                <h3
                  id={`queue-${bucket}`}
                  className={cn(
                    "label-mono flex items-center justify-between border-b border-line-soft/60 bg-sunken/40 px-4 py-2 sm:px-5",
                    bucket === "overdue" ? "text-danger" : "text-fg-muted"
                  )}
                >
                  {bucketLabels[bucket]}
                  <span className="tabular text-muted">
                    {bucket === "overdue" ? summary.taskCounts.overdue : summary.taskCounts.today}
                  </span>
                </h3>
                <ul className="divide-y divide-line-soft/60">
                  {items.slice(0, QUEUE_PREVIEW).map((task) => (
                    <TaskListItem
                      key={task.id}
                      task={task}
                      overdue={bucket === "overdue"}
                      actions="quick"
                      showOwner={false}
                      onOpenDeal={onOpenDeal}
                      onChanged={onTaskCompleted}
                    />
                  ))}
                </ul>
                {items.length > QUEUE_PREVIEW && (
                  <button
                    type="button"
                    onClick={() => onNavigate("tarefas")}
                    className="label-mono flex w-full cursor-pointer items-center justify-center gap-2 border-t border-line-soft/60 py-3 text-muted transition-colors hover:bg-surface-2/50 hover:text-fg focus-visible:focus-ring"
                  >
                    + {items.length - QUEUE_PREVIEW} {bucket === "overdue" ? "atrasadas" : "para hoje"} em Tarefas
                  </button>
                )}
              </section>
            )
          )}
        </div>
      )}
    </Card>
  )
}

function OpenPipeline({ summary, onNavigate }: { summary: DashboardSummary; onNavigate: (view: View) => void }) {
  const counts = new Map(summary.openDealsByStage.map((d) => [d.stage, d.count]))
  const max = Math.max(1, ...summary.openDealsByStage.map((d) => d.count))

  return (
    <Card role="region" aria-labelledby="pipeline-heading">
      <CardHeader>
        <CardTitle id="pipeline-heading">Pipeline aberto</CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={() => onNavigate("pipeline")}>
          Abrir
          <ArrowRight aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-semibold tracking-[-0.02em] text-fg tabular">
            {numberFormatter.format(summary.openDealsTotal)}
          </span>
          <span className="text-sm text-muted">{summary.openDealsTotal === 1 ? "negócio em aberto" : "negócios em aberto"}</span>
        </p>

        {summary.openDealsTotal === 0 ? (
          <p className="text-sm text-muted">Nenhum negócio em andamento. Crie o primeiro a partir da ficha de uma empresa.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {ACTIVE_STAGES.map((stage, index) => {
              const count = counts.get(stage) ?? 0
              return (
                <li key={stage} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={cn("flex items-baseline gap-2", count === 0 ? "text-faint" : "text-fg-muted")}>
                      <span className="font-mono text-2xs text-faint tabular">{String(index + 1).padStart(2, "0")}</span>
                      {stageLabels[stage]}
                    </span>
                    <span className={cn("tabular", count === 0 ? "text-faint" : "font-medium text-fg")}>{count}</span>
                  </div>
                  <div className="h-1 w-full bg-surface-3" aria-hidden="true">
                    <div
                      className="h-full bg-accent transition-[width] duration-500 ease-out"
                      style={{ width: `${count === 0 ? 0 : Math.max(2, (count / max) * 100)}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

function TodayActivities({ summary }: { summary: DashboardSummary }) {
  return (
    <Card role="region" aria-labelledby="activities-heading">
      <CardHeader>
        <CardTitle id="activities-heading">Registrado hoje</CardTitle>
        <span className="font-mono text-2xs text-muted tabular">{summary.activitiesTodayTotal}</span>
      </CardHeader>
      {summary.activitiesToday.length === 0 ? (
        <CardContent>
          <p className="text-sm text-muted">Nenhuma atividade registrada hoje. Ligações e mensagens aparecem aqui assim que registradas.</p>
        </CardContent>
      ) : (
        <ul className="divide-y divide-line-soft/60">
          {summary.activitiesToday.map((a) => {
            const Icon = activityTypeIcons[a.type]
            return (
              <ActivityRow key={a.type} icon={<Icon className="size-3.5" aria-hidden="true" />} label={activityTypeLabels[a.type]} count={a.count} />
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function ActivityRow({ icon, label, count }: { icon: ReactNode; label: string; count: number }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
      <span className="text-muted">{icon}</span>
      <span className="flex-1 text-base text-fg-muted">{label}</span>
      <span className="font-medium text-fg tabular">{numberFormatter.format(count)}</span>
    </li>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status">
      <span className="sr-only">Carregando dashboard…</span>
      <Card className="grid grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 px-6 py-5">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-2.5 w-28" />
          </div>
        ))}
      </Card>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <Card>
          <SkeletonRows rows={6} />
        </Card>
        <Card className="h-80">
          <SkeletonRows rows={4} />
        </Card>
      </div>
    </div>
  )
}
