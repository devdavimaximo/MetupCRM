import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CircleDollarSign, Clock3, Filter, House, Users } from "lucide-react"

import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Alert, Skeleton } from "@/components/ui/states"
import { Hint, TooltipProvider } from "@/components/ui/tooltip"
import { toMessage } from "@/features/companies/form-errors"
import type { DealStage } from "@/features/deals/api"
import type { AuthenticatedUser } from "@/lib/auth"
import type { TaskItem } from "@/features/tasks/api"
import { numberFormatter } from "@/lib/format"
import { addDays, todayLocal, type LocalDate } from "@/lib/local-date"
import { readUrlState, writeUrlState, type View } from "@/lib/url-state"
import { cn } from "@/lib/utils"
import {
  getDashboardOverview,
  getDashboardSummary,
  type DashboardOverview,
  type DashboardSummary,
  type DealScope,
} from "./api"
import { OriginBreakdown, RevenueAreaChart } from "./dashboard-charts"
import { FeaturedDealsCard, KpiCard, Panel, PanelHeading, PipelineCard, PotentialCard, DeltaLine } from "./dashboard-cards"
import {
  closeRate,
  comparisonRange,
  deltaOf,
  deltaPoints,
  formatMoneyWhole,
  formatPercent,
  type DeltaContext,
} from "./dashboard-format"
import {
  isPresetId,
  MAX_PERIOD_DAYS,
  periodLabel,
  periodPresets,
  periodShortLabel,
  periodUrlPatch,
  readInitialPeriod,
  resolvePeriod,
  storePeriod,
  type DashboardPeriod,
} from "./dashboard-period"
import { ActivityFeedSheet } from "./ActivityFeedSheet"
import { SideColumn } from "./dashboard-side"

type Props = {
  userName: string
  role: AuthenticatedUser["role"]
  initialScope: string
  onOpenDeal: (dealId: string) => void
  onOpenCompany: (companyId: string) => void
  onOpenPipelineAtStage: (stage: DealStage) => void
  onNavigate: (view: View) => void
}

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

/** Série acumulada a partir de valores por intervalo. */
function runningSum(values: number[]) {
  return values.reduce<number[]>((acc, v) => [...acc, (acc.at(-1) ?? 0) + v], [])
}

/**
 * Visão geral — a central de comando comercial em uma tela. No desktop o conteúdo cabe na
 * altura da janela (grade com linhas fracionárias); abaixo de xl os blocos empilham.
 *
 * Cada fonte carrega, falha e se recupera sozinha: o panorama (overview) e a fila de tarefas
 * (summary) têm estado, erro e retry próprios.
 */
export function DashboardPage({ userName, role, initialScope, onOpenDeal, onOpenCompany, onOpenPipelineAtStage, onNavigate }: Props) {
  const [period, setPeriod] = useState<DashboardPeriod>(() => readInitialPeriod(readUrlState()))
  // "Hoje" da organização: começa no do navegador e é corrigido pelo servidor na primeira resposta.
  const [orgToday, setOrgToday] = useState<LocalDate>(todayLocal)
  const [scope, setScope] = useState<DealScope>(() =>
    !canSwitchScope(role) || initialScope === "minha" ? "Mine" : "Organization"
  )

  // O "Ver todas" da atividade fica na URL (?feed=1): recarregar ou compartilhar o link reabre o sheet.
  const [feedOpen, setFeedOpenState] = useState(() => readUrlState().activityFeed === "1")
  // Cada abertura remonta o sheet: filtros e lista começam limpos, e a animação de fechar se mantém.
  const [feedSession, setFeedSession] = useState(0)
  const feedTriggerRef = useRef<HTMLButtonElement>(null)
  const setFeedOpen = useCallback((open: boolean) => {
    writeUrlState({ activityFeed: open ? "1" : "" })
    if (open) setFeedSession((session) => session + 1)
    setFeedOpenState(open)
  }, [])

  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [loadedPeriod, setLoadedPeriod] = useState<DashboardPeriod>(period)
  const [isOverviewLoading, setIsOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [overviewVersion, setOverviewVersion] = useState(0)

  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  // Concluídas que o servidor ainda não confirmou numa resposta nova — nunca "ressuscitam".
  const [hiddenTaskIds, setHiddenTaskIds] = useState<ReadonlySet<string>>(() => new Set())
  const summaryRequest = useRef<AbortController | null>(null)

  const request = useMemo(() => resolvePeriod(period, orgToday), [period, orgToday])
  const requestKey = "days" in request ? `d:${request.days}` : `r:${request.from}:${request.to}`

  useEffect(() => {
    const controller = new AbortController()
    setIsOverviewLoading(true)
    setOverviewError(null)
    getDashboardOverview(request, scope, controller.signal)
      .then((data) => {
        setOverview(data)
        setLoadedPeriod(period)
        if ("days" in request) setOrgToday(data.periodEndLocal)
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setOverviewError(toMessage(err, "Não foi possível carregar o panorama."))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsOverviewLoading(false)
      })
    return () => controller.abort()
    // `request` e `period` mudam junto com `requestKey`; a chave evita refazer por identidade de objeto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, scope, overviewVersion])

  /**
   * Busca a fila no servidor. Uma nova busca aborta a anterior, então conclusões em sequência
   * rápida nunca aplicam uma resposta velha por cima de uma nova.
   */
  const loadSummary = useCallback(() => {
    summaryRequest.current?.abort()
    const controller = new AbortController()
    summaryRequest.current = controller
    getDashboardSummary(controller.signal)
      .then((data) => {
        setSummary(data)
        setSummaryError(null)
        setHiddenTaskIds((hidden) => {
          const stillListed = new Set([...hidden].filter((id) => data.nextTasks.some((t) => t.id === id)))
          return stillListed.size === hidden.size ? hidden : stillListed
        })
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setSummaryError(toMessage(err, "Não foi possível carregar suas tarefas."))
      })
  }, [])

  useEffect(() => {
    loadSummary()
    return () => summaryRequest.current?.abort()
  }, [loadSummary])

  function changeScope(next: DealScope) {
    setScope(next)
    writeUrlState({ dashboardScope: next === "Mine" ? "minha" : "" })
  }

  function changePeriod(next: DashboardPeriod) {
    setPeriod(next)
    storePeriod(next)
    writeUrlState(periodUrlPatch(next))
  }

  /** A linha já saiu na animação; os números e a reposição vêm do servidor, nunca de conta local. */
  function handleTaskCompleted(task: TaskItem) {
    setHiddenTaskIds((hidden) => new Set(hidden).add(task.id))
    loadSummary()
  }

  const firstName = userName.trim().split(/\s+/)[0] ?? userName
  const visibleTasks = summary ? summary.nextTasks.filter((t) => !hiddenTaskIds.has(t.id)) : null
  const pickerRange = "days" in request ? { from: addDays(orgToday, -(request.days - 1)), to: orgToday } : request

  const side = (
    <SideColumn
      events={overview?.recentEvents ?? null}
      tasks={visibleTasks}
      overdueCount={summary?.taskCounts.overdue ?? 0}
      tasksError={summaryError}
      onRetryTasks={loadSummary}
      onOpenDeal={onOpenDeal}
      onSeeTasks={() => onNavigate("tarefas")}
      onSeeAllActivity={() => setFeedOpen(true)}
      seeAllActivityRef={feedTriggerRef}
      onTaskCompleted={handleTaskCompleted}
    />
  )

  return (
    <TooltipProvider>
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
              <ScopeIndicator scope={overview?.scope ?? scope} canSwitch={canSwitchScope(role)} onChange={changeScope} />
            </nav>
            <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] text-fg min-[1700px]:text-4xl">
              {greeting()}, {firstName}.
            </h1>
            <p className="text-base text-fg-muted">Aqui está o resumo da sua operação comercial de hoje.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 max-sm:w-full">
            <DateRangePicker
              label={periodLabel(period)}
              presets={periodPresets}
              activePresetId={period.kind === "preset" ? period.preset : null}
              range={pickerRange}
              maxDate={orgToday}
              maxDays={MAX_PERIOD_DAYS}
              onPresetSelect={(id) => {
                if (isPresetId(id)) changePeriod({ kind: "preset", preset: id })
              }}
              onRangeSelect={({ from, to }) => changePeriod({ kind: "custom", from, to })}
              className="min-w-56 max-sm:flex-1"
            />
          </div>
        </header>

        {overviewError && (
          <Alert onRetry={() => setOverviewVersion((v) => v + 1)}>
            {overview ? `${overviewError} Mostrando os dados de ${periodLabel(loadedPeriod)}.` : overviewError}
          </Alert>
        )}

        {!overview && !overviewError ? (
          <DashboardSkeleton />
        ) : (
          <div
            aria-busy={isOverviewLoading}
            className="relative grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_19rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]"
          >
            {overview ? (
              <MainGrid
                overview={overview}
                period={loadedPeriod}
                // Dados de outro período (carregando ou com erro) ficam esmaecidos até a resposta nova.
                stale={isOverviewLoading || overviewError !== null}
                onOpenDeal={onOpenDeal}
                onOpenCompany={onOpenCompany}
                onOpenStage={onOpenPipelineAtStage}
                onNavigate={onNavigate}
              />
            ) : (
              <Panel className="items-center justify-center p-8 text-center text-sm text-muted">
                O panorama não carregou. Suas tarefas continuam disponíveis ao lado.
              </Panel>
            )}
            {side}
          </div>
        )}
      </div>

      <ActivityFeedSheet
        key={feedSession}
        open={feedOpen}
        role={role}
        onOpenChange={setFeedOpen}
        returnFocusRef={feedTriggerRef}
        onOpenDeal={(dealId) => {
          setFeedOpen(false)
          onOpenDeal(dealId)
        }}
      />
    </TooltipProvider>
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
      <Hint content="Você vê os números dos negócios sob sua responsabilidade.">
        <span tabIndex={0} className="rounded-xs text-fg-muted focus-visible:focus-ring">
          {scopeLabels.Mine}
        </span>
      </Hint>
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
  period,
  stale,
  onOpenDeal,
  onOpenCompany,
  onOpenStage,
  onNavigate,
}: {
  overview: DashboardOverview
  period: DashboardPeriod
  stale: boolean
  onOpenDeal: (dealId: string) => void
  onOpenCompany: (companyId: string) => void
  onOpenStage: (stage: DealStage) => void
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

  const periodName = periodLabel(period)
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
  const revenueDelta = deltaOf(overview.revenue, deltaContext)

  return (
    <div
      className={cn(
        "grid min-h-0 min-w-0 gap-4 transition-opacity xl:grid-rows-[auto_auto_minmax(10rem,0.92fr)_minmax(12rem,1.08fr)]",
        stale && "opacity-60"
      )}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4 xl:grid-cols-4">
        <KpiCard
          icon={CircleDollarSign}
          label="Receita Gerada"
          hint={`soma do valor dos negócios ganhos · ${periodName}`}
          value={formatMoneyWhole(overview.revenue.current)}
          delta={deltaOf(overview.revenue, deltaContext)}
          comparison={comparison}
          trend={trends.revenue}
        />
        <KpiCard
          icon={Users}
          label="Negócios Fechados"
          hint={`negócios ganhos · ${periodName}`}
          value={numberFormatter.format(won.current)}
          delta={deltaOf(won, deltaContext)}
          comparison={comparison}
          trend={trends.won}
        />
        <KpiCard
          icon={Filter}
          label="Taxa de fechamento"
          hint={`ganhos ÷ (ganhos + perdidos) · ${periodName}`}
          value={rate === null ? "—" : formatPercent(rate)}
          delta={deltaPoints(rate, prevRate, deltaContext)}
          comparison={comparison}
          trend={trends.rate}
        />
        <KpiCard
          icon={Clock3}
          label="Ticket Médio"
          hint={`receita ganha ÷ negócios ganhos · ${periodName}`}
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
        periodShort={periodShortLabel(period)}
        periodName={periodName}
        onOpenStage={onOpenStage}
      />

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Panel aria-labelledby="revenue-heading" className="gap-2 px-4 pt-3.5 pb-2">
          <PanelHeading
            id="revenue-heading"
            title="Evolução da Receita"
            subtitle={`Receita acumulada · ${periodName}`}
            aside={
              <div className="shrink-0 text-right">
                <DeltaLine delta={revenueDelta} comparison={comparison} />
              </div>
            }
          />
          <div className="relative h-60 min-h-0 xl:h-auto xl:min-h-24 xl:flex-1">
            <RevenueAreaChart data={chartData} previousTotal={revenueDelta.kind === "change" ? overview.revenue.previous : null} />
            {overview.revenue.current === 0 && (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">
                Nenhum negócio ganho neste período.
              </p>
            )}
          </div>
        </Panel>

        <Panel aria-labelledby="origin-heading" className="gap-3 px-4 py-3.5">
          <PanelHeading id="origin-heading" title="Origem dos Negócios" subtitle={`Negócios que entraram · ${periodName}`} />
          <OriginBreakdown sources={overview.sources} />
        </Panel>
      </div>

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <FeaturedDealsCard
          deals={overview.featuredDeals}
          today={overview.expectedClose.windowStartLocal}
          onOpenDeal={onOpenDeal}
          onOpenCompany={onOpenCompany}
        />
        <PotentialCard
          openAmount={openAmount}
          forecast={overview.weightedForecast}
          expectedClose={overview.expectedClose}
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
