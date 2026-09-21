import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { CircleDollarSign, Clock3, Filter, House, Users } from "lucide-react"

import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Alert, Skeleton } from "@/components/ui/states"
import { Hint, TooltipProvider } from "@/components/ui/tooltip"
import { toMessage } from "@/features/companies/form-errors"
import type { DealStage } from "@/features/deals/api"
import type { AuthenticatedUser } from "@/lib/auth"
import type { TaskItem } from "@/features/tasks/api"
import { numberFormatter } from "@/lib/format"
import { useAsyncResource, useMediaQuery } from "@/lib/hooks"
import { addDays, todayLocal, type LocalDate } from "@/lib/local-date"
import { useRealtime, useRealtimeStatus } from "@/lib/realtime"
import { readUrlState, writeUrlState, type View } from "@/lib/url-state"
import { cn } from "@/lib/utils"
import { getDashboardOverview, getDashboardSummary, type DashboardOverview, type DealScope } from "./api"
import { OriginBreakdown, RevenueAreaChart } from "./dashboard-charts"
import { DeltaLine, KpiCard, KpiCarousel } from "@/components/metrics/KpiCard"
import { Panel, PanelHeading } from "@/components/metrics/panel"
import { FeaturedDealsCard, PipelineCard, PotentialCard } from "./dashboard-cards"
import {
  closeRate,
  comparisonRange,
  deltaOf,
  deltaPoints,
  formatMoneyWhole,
  formatPercent,
  type Delta,
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
import { PeriodDetailsPopover } from "./PeriodDetailsPopover"
import { NextTasksSection, RecentActivitySection, SideColumn } from "./dashboard-side"

type Props = {
  userName: string
  role: AuthenticatedUser["role"]
  initialScope: string
  onOpenDeal: (dealId: string) => void
  onOpenCompany: (companyId: string) => void
  onLogActivity: (dealId: string) => void
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

/** Espera depois do último evento em tempo real antes de refazer as consultas. */
const REALTIME_DEBOUNCE_MS = 2_000
/** Quanto tempo o evento novo fica realçado na Atividade Recente. */
const HIGHLIGHT_MS = 2_500

/** Ponto discreto do estado do tempo real, com o texto no tooltip e para leitor de tela. */
function RealtimeIndicator() {
  const status = useRealtimeStatus()
  const live = status === "connected"
  const text = live ? "Atualização em tempo real" : "Reconectando…"
  return (
    <Hint content={text}>
      <span tabIndex={0} data-testid="realtime-indicator" data-status={status} className="ml-1 inline-flex size-4 items-center justify-center rounded-full focus-visible:focus-ring">
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", live ? "bg-success" : "animate-pulse bg-accent motion-reduce:animate-none")}
        />
        <span className="sr-only">{text}</span>
      </span>
    </Hint>
  )
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
export function DashboardPage({
  userName,
  role,
  initialScope,
  onOpenDeal,
  onOpenCompany,
  onLogActivity,
  onOpenPipelineAtStage,
  onNavigate,
}: Props) {
  // Abaixo de `md` a tela é reorganizada por ação (item 26). É a árvore que muda, não só o estilo:
  // a ordem do DOM tem que acompanhar a ordem visual para o teclado e o leitor de tela.
  const isMobile = useMediaQuery("(max-width: 767px)")
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

  const [loadedPeriod, setLoadedPeriod] = useState<DashboardPeriod>(period)
  // Concluídas que o servidor ainda não confirmou numa resposta nova — nunca "ressuscitam".
  const [hiddenTaskIds, setHiddenTaskIds] = useState<ReadonlySet<string>>(() => new Set())
  // Ids da Atividade Recente já mostrados: o que chegar fora deles, via tempo real, ganha realce.
  const knownEventIds = useRef<ReadonlySet<string> | null>(null)
  const [highlightedEventIds, setHighlightedEventIds] = useState<ReadonlySet<string>>(() => new Set())
  const highlightTimer = useRef<number | undefined>(undefined)

  const request = useMemo(() => resolvePeriod(period, orgToday), [period, orgToday])
  const requestKey = "days" in request ? `d:${request.days}` : `r:${request.from}:${request.to}`

  /**
   * O panorama do período. Os dados do período anterior seguem na tela (esmaecidos) enquanto o novo
   * não chega; uma troca de período cancela a busca anterior.
   */
  const overviewResource = useAsyncResource(
    (signal) => getDashboardOverview(request, scope, signal),
    // `request` e `period` mudam junto com `requestKey`; a chave evita refazer por identidade de objeto.
    [requestKey, scope],
    {
      keepPreviousData: true,
      onSuccess: (data, { silent }) => {
        const known = knownEventIds.current ?? new Set<string>()
        knownEventIds.current = new Set(data.recentEvents.map((event) => event.id))

        if (!silent) {
          // Eventos que vieram por troca de período/escopo não são "novos" para o realce do tempo real.
          setLoadedPeriod(period)
          if ("days" in request) setOrgToday(data.periodEndLocal)
          return
        }

        const fresh = data.recentEvents.filter((event) => !known.has(event.id)).map((event) => event.id)
        if (fresh.length === 0) return
        setHighlightedEventIds(new Set(fresh))
        window.clearTimeout(highlightTimer.current)
        highlightTimer.current = window.setTimeout(() => setHighlightedEventIds(new Set()), HIGHLIGHT_MS)
      },
    }
  )

  /** A fila de hoje. Uma nova busca cancela a anterior: conclusões em sequência rápida não se atropelam. */
  const summaryResource = useAsyncResource((signal) => getDashboardSummary(signal), [], {
    keepPreviousData: true,
    onSuccess: (data) =>
      setHiddenTaskIds((hidden) => {
        const stillListed = new Set([...hidden].filter((id) => data.nextTasks.some((t) => t.id === id)))
        return stillListed.size === hidden.size ? hidden : stillListed
      }),
  })

  const overview = overviewResource.data
  const isOverviewLoading = overviewResource.isLoading
  const overviewError = overviewResource.error ? toMessage(overviewResource.error, "Não foi possível carregar o panorama.") : null
  const summary = summaryResource.data
  const summaryError = summaryResource.error ? toMessage(summaryResource.error, "Não foi possível carregar suas tarefas.") : null
  const loadSummary = summaryResource.reload

  // ── Tempo real ────────────────────────────────────────────────────────────────
  // Evento chegou (ou a conexão voltou / a aba ganhou foco sem conexão): refaz overview e tarefas em
  // segundo plano, 2s depois do último evento, sem skeleton e com o mesmo período e escopo. Uma troca
  // de período em andamento já vai trazer dados novos, então o recarregamento silencioso a respeita.
  const realtimeTimer = useRef<number | undefined>(undefined)

  useEffect(
    () => () => {
      window.clearTimeout(realtimeTimer.current)
      window.clearTimeout(highlightTimer.current)
    },
    []
  )

  const refreshSilently = useCallback(() => {
    loadSummary()
    overviewResource.reload({ silent: true })
  }, [loadSummary, overviewResource])

  useRealtime(() => {
    window.clearTimeout(realtimeTimer.current)
    realtimeTimer.current = window.setTimeout(refreshSilently, REALTIME_DEBOUNCE_MS)
  })

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

  const activityProps = {
    events: overview?.recentEvents ?? null,
    onOpenDeal,
    onSeeAllActivity: () => setFeedOpen(true),
    seeAllActivityRef: feedTriggerRef,
    highlightedEventIds,
  }
  const tasksProps = {
    tasks: visibleTasks,
    overdueCount: summary?.taskCounts.overdue ?? 0,
    tasksError: summaryError,
    onRetryTasks: loadSummary,
    onOpenDeal,
    onSeeTasks: () => onNavigate("tarefas"),
    onTaskCompleted: handleTaskCompleted,
  }

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
              <RealtimeIndicator />
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
            <PeriodDetailsPopover
              overview={overview}
              periodName={periodLabel(loadedPeriod)}
              scope={overview?.scope ?? scope}
              currentUserName={userName}
            />
          </div>
        </header>

        {overviewError && (
          <Alert onRetry={() => overviewResource.reload()}>
            {overview ? `${overviewError} Mostrando os dados de ${periodLabel(loadedPeriod)}.` : overviewError}
          </Alert>
        )}

        {!overview && !overviewError ? (
          <DashboardSkeleton />
        ) : isMobile ? (
          // Ordem de ação: as tarefas de hoje vêm antes de qualquer número.
          <div aria-busy={isOverviewLoading} className="relative flex min-w-0 flex-col gap-4">
            <Panel>
              <NextTasksSection {...tasksProps} />
            </Panel>
            {overview ? (
              <MobileGrid
                overview={overview}
                period={loadedPeriod}
                stale={isOverviewLoading || overviewError !== null}
                onOpenDeal={onOpenDeal}
                onOpenCompany={onOpenCompany}
                onLogActivity={onLogActivity}
                onOpenStage={onOpenPipelineAtStage}
                activity={
                  <Panel className="overflow-hidden pb-3">
                    <RecentActivitySection {...activityProps} />
                  </Panel>
                }
              />
            ) : (
              <Panel className="items-center justify-center p-8 text-center text-sm text-muted">
                O panorama não carregou. Suas tarefas continuam disponíveis acima.
              </Panel>
            )}
          </div>
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
                onLogActivity={onLogActivity}
                onOpenStage={onOpenPipelineAtStage}
                onNavigate={onNavigate}
              />
            ) : (
              <Panel className="items-center justify-center p-8 text-center text-sm text-muted">
                O panorama não carregou. Suas tarefas continuam disponíveis ao lado.
              </Panel>
            )}
            <SideColumn {...activityProps} {...tasksProps} />
          </div>
        )}
      </div>

      <ActivityFeedSheet
        key={feedSession}
        open={feedOpen}
        role={role}
        today={orgToday}
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

type KpiSpec = {
  icon: typeof CircleDollarSign
  label: string
  hint: string
  value: string
  delta: Delta
  trend: number[]
}

type OverviewModel = {
  periodName: string
  comparison: string
  revenueDelta: Delta
  rate: number | null
  kpis: KpiSpec[]
  chartData: { bucketStart: string; cumulative: number; revenue: number; wonDeals: number }[]
  openAmount: number
  closingAmount: number
}

/** Tudo que as duas montagens (desktop e celular) derivam do panorama — calculado uma vez só. */
function useOverviewModel(overview: DashboardOverview, period: DashboardPeriod): OverviewModel {
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

  const deltaContext: DeltaContext = {
    historyStart: overview.historyStart,
    previousStart: overview.previousStart,
    periodStart: overview.periodStart,
  }

  return {
    periodName,
    comparison: comparisonRange(deltaContext),
    revenueDelta: deltaOf(overview.revenue, deltaContext),
    rate,
    kpis: [
      {
        icon: CircleDollarSign,
        label: "Receita Gerada",
        hint: `soma do valor dos negócios ganhos · ${periodName}`,
        value: formatMoneyWhole(overview.revenue.current),
        delta: deltaOf(overview.revenue, deltaContext),
        trend: trends.revenue,
      },
      {
        icon: Users,
        label: "Negócios Fechados",
        hint: `negócios ganhos · ${periodName}`,
        value: numberFormatter.format(won.current),
        delta: deltaOf(won, deltaContext),
        trend: trends.won,
      },
      {
        icon: Filter,
        label: "Taxa de fechamento",
        hint: `ganhos ÷ (ganhos + perdidos) · ${periodName}`,
        value: rate === null ? "—" : formatPercent(rate),
        delta: deltaPoints(rate, prevRate, deltaContext),
        trend: trends.rate,
      },
      {
        icon: Clock3,
        label: "Ticket Médio",
        hint: `receita ganha ÷ negócios ganhos · ${periodName}`,
        value: avgTicket === null ? "—" : formatMoneyWhole(avgTicket),
        delta: deltaOf({ current: avgTicket ?? 0, previous: prevTicket ?? 0 }, deltaContext),
        trend: trends.ticket,
      },
    ],
    chartData,
    openAmount: overview.pipeline.reduce((sum, s) => sum + s.amount, 0),
    closingAmount: overview.pipeline
      .filter((s) => s.stage === "Proposta" || s.stage === "Negociacao")
      .reduce((sum, s) => sum + s.amount, 0),
  }
}

function RevenuePanel({
  overview,
  model,
  chartClassName,
}: {
  overview: DashboardOverview
  model: OverviewModel
  chartClassName: string
}) {
  return (
    <Panel aria-labelledby="revenue-heading" className="gap-2 px-4 pt-3.5 pb-2">
      <PanelHeading
        id="revenue-heading"
        title="Evolução da Receita"
        subtitle={`Receita acumulada · ${model.periodName}`}
        aside={
          <div className="shrink-0 text-right">
            <DeltaLine delta={model.revenueDelta} comparison={model.comparison} />
          </div>
        }
      />
      <div className={cn("relative min-h-0", chartClassName)}>
        <RevenueAreaChart
          data={model.chartData}
          previousTotal={model.revenueDelta.kind === "change" ? overview.revenue.previous : null}
        />
        {overview.revenue.current === 0 && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">
            Nenhum negócio ganho neste período.
          </p>
        )}
      </div>
    </Panel>
  )
}

function OriginPanel({ overview, periodName }: { overview: DashboardOverview; periodName: string }) {
  return (
    <Panel aria-labelledby="origin-heading" className="gap-3 px-4 py-3.5">
      <PanelHeading id="origin-heading" title="Origem dos Negócios" subtitle={`Negócios que entraram · ${periodName}`} />
      <OriginBreakdown sources={overview.sources} />
    </Panel>
  )
}

type GridProps = {
  overview: DashboardOverview
  period: DashboardPeriod
  stale: boolean
  onOpenDeal: (dealId: string) => void
  onOpenCompany: (companyId: string) => void
  onLogActivity: (dealId: string) => void
  onOpenStage: (stage: DealStage) => void
  onNavigate: (view: View) => void
}

function MainGrid({ overview, period, stale, onOpenDeal, onOpenCompany, onLogActivity, onOpenStage, onNavigate }: GridProps) {
  const model = useOverviewModel(overview, period)

  return (
    <div
      className={cn(
        "grid min-h-0 min-w-0 gap-4 transition-opacity xl:grid-rows-[auto_auto_minmax(10rem,0.92fr)_minmax(12rem,1.08fr)]",
        stale && "opacity-60"
      )}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4 xl:grid-cols-4">
        {model.kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} comparison={model.comparison} />
        ))}
      </div>

      <PipelineCard
        pipeline={overview.pipeline}
        advanceRates={overview.stageAdvanceRates}
        wonInPeriod={overview.wonDeals.current}
        wonAmount={overview.revenue.current}
        closeRateValue={model.rate}
        stalledAfterDays={overview.stalledAfterDays}
        periodShort={periodShortLabel(period)}
        periodName={model.periodName}
        onOpenStage={onOpenStage}
      />

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <RevenuePanel overview={overview} model={model} chartClassName="h-60 xl:h-auto xl:min-h-24 xl:flex-1" />
        <OriginPanel overview={overview} periodName={model.periodName} />
      </div>

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <FeaturedDealsCard
          deals={overview.featuredDeals}
          today={overview.expectedClose.windowStartLocal}
          onOpenDeal={onOpenDeal}
          onOpenCompany={onOpenCompany}
          onLogActivity={onLogActivity}
        />
        <PotentialCard
          openAmount={model.openAmount}
          forecast={overview.weightedForecast}
          expectedClose={overview.expectedClose}
          closingAmount={model.closingAmount}
          onOpenPipeline={() => onNavigate("pipeline")}
        />
      </div>
    </div>
  )
}

/**
 * A mesma tela no celular, em ordem de ação: primeiro o que exige trabalho (tarefas), depois os
 * números, e por último o que é consulta. A ordem do DOM é a ordem visual — nada de `order` do CSS,
 * que moveria o pixel e deixaria o teclado e o leitor de tela na ordem antiga.
 *
 * O cartão Metup não entra: é peça de assinatura de marca, e no celular custaria uma tela inteira
 * de rolagem sem dizer nada que o pipeline já não diga.
 */
function MobileGrid({
  overview,
  period,
  stale,
  onOpenDeal,
  onOpenCompany,
  onLogActivity,
  onOpenStage,
  activity,
}: Omit<GridProps, "onNavigate"> & { activity: ReactNode }) {
  const model = useOverviewModel(overview, period)

  return (
    <div className={cn("flex min-w-0 flex-col gap-4 transition-opacity", stale && "opacity-60")}>
      <KpiCarousel label="Indicadores do período">
        {model.kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} comparison={model.comparison} />
        ))}
      </KpiCarousel>

      <PipelineCard
        compact
        pipeline={overview.pipeline}
        advanceRates={overview.stageAdvanceRates}
        wonInPeriod={overview.wonDeals.current}
        wonAmount={overview.revenue.current}
        closeRateValue={model.rate}
        stalledAfterDays={overview.stalledAfterDays}
        periodShort={periodShortLabel(period)}
        periodName={model.periodName}
        onOpenStage={onOpenStage}
      />

      <RevenuePanel overview={overview} model={model} chartClassName="h-56" />

      <FeaturedDealsCard
        compact
        deals={overview.featuredDeals}
        today={overview.expectedClose.windowStartLocal}
        onOpenDeal={onOpenDeal}
        onOpenCompany={onOpenCompany}
        onLogActivity={onLogActivity}
      />

      {activity}

      <OriginPanel overview={overview} periodName={model.periodName} />
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
