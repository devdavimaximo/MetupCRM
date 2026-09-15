import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarDays, ChevronDown, CircleDollarSign, Clock3, Filter, House, Users } from "lucide-react"

import { Alert, Skeleton } from "@/components/ui/states"
import { toMessage } from "@/features/companies/form-errors"
import type { AuthenticatedUser } from "@/lib/auth"
import type { TaskItem } from "@/features/tasks/api"
import { numberFormatter } from "@/lib/format"
import { writeUrlState, type View } from "@/lib/url-state"
import { cn } from "@/lib/utils"
import { sourceLabels } from "@/features/deals/stage-labels"
import {
  getDashboardOverview,
  getDashboardSummary,
  type DashboardOverview,
  type DashboardSummary,
  type DealScope,
} from "./api"
import { OriginDonut, RevenueAreaChart } from "./dashboard-charts"
import { FeaturedDealsCard, KpiCard, Panel, PanelHeading, PipelineCard, PotentialCard, DeltaLine } from "./dashboard-cards"
import {
  closeRate,
  comparisonRange,
  deltaOf,
  deltaPoints,
  DONUT_COLORS,
  formatLongDate,
  formatMoneyWhole,
  formatPercent,
  periodOptions,
  type DeltaContext,
  type PeriodValueKey,
} from "./dashboard-format"
import { SideColumn } from "./dashboard-side"

type Props = {
  userName: string
  role: AuthenticatedUser["role"]
  initialScope: string
  onOpenDeal: (dealId: string) => void
  onNavigate: (view: View) => void
}

const PERIOD_STORAGE_KEY = "metup.dashboard.period"

/** Só Admin e Closer alcançam a organização inteira — o servidor decide de novo, isto é só a UI. */
function canSwitchScope(role: AuthenticatedUser["role"]) {
  return role === "Admin" || role === "Closer"
}

const scopeLabels: Record<DealScope, string> = { Organization: "Organização", Mine: "Sua carteira" }

function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return "Bom dia"
  if (hour < 18) return "Boa tarde"
  return "Boa noite"
}

function readStoredPeriod(): PeriodValueKey {
  try {
    const stored = localStorage.getItem(PERIOD_STORAGE_KEY)
    return periodOptions.some((o) => o.value === stored) ? (stored as PeriodValueKey) : "30"
  } catch {
    return "30"
  }
}

/** Série acumulada a partir de valores por intervalo. */
function runningSum(values: number[]) {
  return values.reduce<number[]>((acc, v) => [...acc, (acc.at(-1) ?? 0) + v], [])
}

/**
 * Visão geral — a central de comando comercial em uma tela. No desktop o conteúdo cabe na
 * altura da janela (grade com linhas fracionárias); abaixo de xl os blocos empilham.
 */
export function DashboardPage({ userName, role, initialScope, onOpenDeal, onNavigate }: Props) {
  const [period, setPeriod] = useState<PeriodValueKey>(readStoredPeriod)
  const [scope, setScope] = useState<DealScope>(() =>
    !canSwitchScope(role) || initialScope === "minha" ? "Mine" : "Organization"
  )
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)

  const reload = useCallback(() => setReloadVersion((v) => v + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)
    getDashboardOverview(Number(period), scope, controller.signal)
      .then(setOverview)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(toMessage(err, "Não foi possível carregar o dashboard."))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [period, scope, reloadVersion])

  useEffect(() => {
    const controller = new AbortController()
    getDashboardSummary(controller.signal)
      .then(setSummary)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(toMessage(err, "Não foi possível carregar suas tarefas."))
      })
    return () => controller.abort()
  }, [reloadVersion])

  function changeScope(next: DealScope) {
    setScope(next)
    writeUrlState({ dashboardScope: next === "Mine" ? "minha" : "" })
  }

  function changePeriod(next: PeriodValueKey) {
    setPeriod(next)
    try {
      localStorage.setItem(PERIOD_STORAGE_KEY, next)
    } catch {
      /* conveniência — sem storage, só não lembra */
    }
  }

  function handleTaskCompleted(task: TaskItem) {
    const overdue = new Date(task.dueDate) < new Date()
    setSummary((current) =>
      current
        ? {
            ...current,
            nextTasks: current.nextTasks.filter((t) => t.id !== task.id),
            todayTasks: current.todayTasks.filter((t) => t.id !== task.id),
            taskCounts: { ...current.taskCounts, overdue: current.taskCounts.overdue - (overdue ? 1 : 0) },
          }
        : current
    )
  }

  const firstName = userName.trim().split(/\s+/)[0] ?? userName

  return (
    <div className="relative mx-auto flex w-full max-w-[112rem] flex-col gap-5 overflow-x-clip px-4 pt-5 pb-8 sm:px-6 xl:h-svh xl:min-h-[56rem] xl:gap-4 xl:px-8 xl:pt-4 xl:pb-4">
      <HeaderGlow />

      <header className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-col gap-1">
          <nav aria-label="Trilha" className="flex items-center gap-2 text-xs text-muted">
            <House className="size-3.5 text-accent" aria-hidden="true" />
            <span>CRM</span>
            <span aria-hidden="true">/</span>
            <span aria-current="page" className="text-accent">
              Visão geral
            </span>
            <span aria-hidden="true">·</span>
            <ScopeIndicator
              scope={overview?.scope ?? scope}
              canSwitch={canSwitchScope(role)}
              onChange={changeScope}
            />
          </nav>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] text-fg min-[1700px]:text-4xl">
            {greeting()}, {firstName}.
          </h1>
          <p className="text-base text-fg-muted">Aqui está o resumo da sua operação comercial de hoje.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 max-sm:w-full">
          <span className="inline-flex h-10 items-center gap-3 rounded-md border border-line-soft bg-surface px-4 text-sm text-fg max-sm:flex-1">
            <CalendarDays className="size-4 text-fg-muted" aria-hidden="true" />
            {formatLongDate()}
          </span>
          <label className="relative inline-flex h-10 items-center rounded-md border border-line-soft bg-surface text-sm text-fg focus-within:focus-ring max-sm:flex-1">
            <span className="sr-only">Período de análise</span>
            <select
              value={period}
              onChange={(e) => changePeriod(e.target.value as PeriodValueKey)}
              className="h-full w-full min-w-44 cursor-pointer appearance-none bg-transparent pr-10 pl-4 outline-none"
            >
              {periodOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 size-4 text-fg-muted" aria-hidden="true" />
          </label>
        </div>
      </header>

      {error && <Alert onRetry={reload}>{error}</Alert>}

      {!overview ? (
        !error && <DashboardSkeleton />
      ) : (
        <div
          aria-busy={isLoading}
          className={cn(
            "relative grid min-h-0 flex-1 gap-4 transition-opacity xl:grid-cols-[minmax(0,1fr)_19rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]",
            isLoading && "opacity-60"
          )}
        >
          <MainGrid overview={overview} onOpenDeal={onOpenDeal} onNavigate={onNavigate} />
          <SideColumn
            events={overview.recentEvents}
            tasks={summary?.nextTasks ?? null}
            overdueCount={summary?.taskCounts.overdue ?? 0}
            onOpenDeal={onOpenDeal}
            onSeeTasks={() => onNavigate("tarefas")}
            onTaskCompleted={handleTaskCompleted}
          />
        </div>
      )}
    </div>
  )
}

/**
 * De quem são os números desta tela. O SDR só lê o rótulo (o servidor nunca lhe dá mais que a
 * própria carteira); Admin e Closer alternam, e a escolha fica na URL para o link ser compartilhável.
 */
function ScopeIndicator({
  scope,
  canSwitch,
  onChange,
}: {
  scope: DealScope
  canSwitch: boolean
  onChange: (scope: DealScope) => void
}) {
  if (!canSwitch) {
    return (
      <span className="text-fg-muted" title="Você vê os números dos negócios sob sua responsabilidade.">
        {scopeLabels.Mine}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1" role="group" aria-label="Escopo dos números">
      {(["Organization", "Mine"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={scope === option}
          onClick={() => onChange(option)}
          className={cn(
            "cursor-pointer rounded-xs px-1.5 py-0.5 transition-colors hover:text-fg focus-visible:focus-ring",
            scope === option ? "bg-surface-3 text-fg" : "text-muted"
          )}
        >
          {scopeLabels[option]}
        </button>
      ))}
    </span>
  )
}

function MainGrid({
  overview,
  onOpenDeal,
  onNavigate,
}: {
  overview: DashboardOverview
  onOpenDeal: (dealId: string) => void
  onNavigate: (view: View) => void
}) {
  const series = overview.revenueSeries
  const trends = useMemo(() => {
    const revenue = runningSum(series.map((p) => p.revenue))
    const won = runningSum(series.map((p) => p.wonDeals))
    const lost = runningSum(series.map((p) => p.lostDeals))
    return {
      revenue,
      won,
      rate: won.map((w, i) => closeRate(w, lost[i]) ?? 0),
      ticket: won.map((w, i) => (w === 0 ? 0 : revenue[i] / w)),
    }
  }, [series])

  const chartData = useMemo(
    () => series.map((p, i) => ({ bucketStart: p.bucketStart, cumulative: trends.revenue[i], revenue: p.revenue, wonDeals: p.wonDeals })),
    [series, trends]
  )

  const won = overview.wonDeals
  const avgTicket = won.current > 0 ? overview.revenue.current / won.current : null
  const prevTicket = won.previous > 0 ? overview.revenue.previous / won.previous : null
  const rate = closeRate(won.current, overview.lostDeals.current)
  const prevRate = closeRate(won.previous, overview.lostDeals.previous)

  const openAmount = overview.pipeline.reduce((sum, s) => sum + s.amount, 0)
  const closingAmount = overview.pipeline
    .filter((s) => s.stage === "Proposta" || s.stage === "Negociacao")
    .reduce((sum, s) => sum + s.amount, 0)

  const deltaContext: DeltaContext = {
    historyStart: overview.historyStart,
    previousStart: overview.previousStart,
    periodStart: overview.periodStart,
  }
  const comparison = comparisonRange(deltaContext)

  const totalNew = overview.sources.reduce((sum, s) => sum + s.newDeals, 0)
  const slices = overview.sources.map((s) => ({ key: s.source, label: sourceLabels[s.source], value: s.newDeals }))

  return (
    <div className="grid min-h-0 min-w-0 gap-4 xl:grid-rows-[auto_auto_minmax(10rem,0.92fr)_minmax(12rem,1.08fr)]">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4 xl:grid-cols-4">
        <KpiCard
          icon={CircleDollarSign}
          label="Receita Gerada"
          hint="soma do valor dos negócios ganhos no período"
          value={formatMoneyWhole(overview.revenue.current)}
          delta={deltaOf(overview.revenue, deltaContext)}
          comparison={comparison}
          trend={trends.revenue}
        />
        <KpiCard
          icon={Users}
          label="Negócios Fechados"
          hint="negócios ganhos no período"
          value={numberFormatter.format(won.current)}
          delta={deltaOf(won, deltaContext)}
          comparison={comparison}
          trend={trends.won}
        />
        <KpiCard
          icon={Filter}
          label="Taxa de fechamento"
          hint="ganhos ÷ (ganhos + perdidos) no período"
          value={rate === null ? "—" : formatPercent(rate)}
          delta={deltaPoints(rate, prevRate, deltaContext)}
          comparison={comparison}
          trend={trends.rate}
        />
        <KpiCard
          icon={Clock3}
          label="Ticket Médio"
          hint="receita ganha ÷ negócios ganhos no período"
          value={avgTicket === null ? "—" : formatMoneyWhole(avgTicket)}
          delta={deltaOf({ current: avgTicket ?? 0, previous: prevTicket ?? 0 }, deltaContext)}
          comparison={comparison}
          trend={trends.ticket}
        />
      </div>

      <PipelineCard
        pipeline={overview.pipeline}
        advanceRates={overview.stageAdvanceRates}
        wonInPeriod={won.current}
        wonAmount={overview.revenue.current}
        closeRateValue={rate}
        stalledAfterDays={overview.stalledAfterDays}
      />

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Panel aria-labelledby="revenue-heading" className="gap-2 px-4 pt-3.5 pb-2">
          <PanelHeading
            id="revenue-heading"
            title="Evolução da Receita"
            subtitle="Receita acumulada da sua operação ao longo do período."
            aside={
              <div className="shrink-0 text-right">
                <DeltaLine delta={deltaOf(overview.revenue, deltaContext)} comparison={comparison} />
              </div>
            }
          />
          <div className="relative h-60 min-h-0 xl:h-auto xl:min-h-24 xl:flex-1">
            <RevenueAreaChart data={chartData} />
            {overview.revenue.current === 0 && (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">
                Nenhum negócio ganho neste período.
              </p>
            )}
          </div>
        </Panel>

        <Panel aria-labelledby="origin-heading" className="gap-3 px-4 py-3.5">
          <PanelHeading id="origin-heading" title="Origem dos Negócios" subtitle="De onde vêm os negócios que entraram no período." />
          <div className="flex min-h-0 flex-1 items-center gap-5">
            <div className="my-2 size-28 shrink-0 min-[1700px]:size-34">
              <OriginDonut slices={slices} total={totalNew} caption="no período" />
            </div>
            <ul className="flex min-w-0 flex-1 flex-col gap-3">
              {overview.sources.length === 0 && <li className="text-sm text-muted">Nenhum negócio novo.</li>}
              {overview.sources.map((s, i) => (
                <li key={s.source} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    <span className="truncate text-fg-muted">{sourceLabels[s.source]}</span>
                  </span>
                  <span className="text-fg tabular" title={`${s.newDeals} negócios · ${s.wonDeals} ganhos`}>
                    {formatPercent(totalNew === 0 ? 0 : s.newDeals / totalNew)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <FeaturedDealsCard deals={overview.featuredDeals} onOpenDeal={onOpenDeal} />
        <PotentialCard
          openAmount={openAmount}
          forecast={overview.weightedForecast}
          closingAmount={closingAmount}
          onOpenPipeline={() => onNavigate("pipeline")}
        />
      </div>
    </div>
  )
}

/** O arco dourado do topo — a luz que atravessa o cabeçalho na referência, em traço fino. */
function HeaderGlow() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute -top-8 left-1/4 hidden h-48 w-[55%] xl:block" viewBox="0 0 800 200" fill="none">
      <defs>
        <linearGradient id="dash-arc" x1="0" x2="1" y1="1" y2="0">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0" />
          <stop offset="70%" stopColor="var(--color-accent)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 200 C 280 150, 520 90, 780 0" stroke="url(#dash-arc)" strokeWidth="1.5" />
    </svg>
  )
}

function DashboardSkeleton() {
  return (
    <div role="status" className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_19rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
      <span className="sr-only">Carregando dashboard…</span>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-44 rounded-lg" />
        <Skeleton className="h-64 flex-1 rounded-lg" />
      </div>
      <Skeleton className="h-96 rounded-lg xl:h-full" />
    </div>
  )
}
