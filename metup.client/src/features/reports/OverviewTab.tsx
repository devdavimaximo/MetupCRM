import { ArrowRight, CircleDollarSign, Clock3, Filter, Target } from "lucide-react"

import { KpiCard, KpiCarousel } from "@/components/metrics/KpiCard"
import { SeeAll } from "@/components/metrics/panel"
import { Monogram } from "@/components/ui/monogram"
import { EmptyState } from "@/components/ui/states"
import { comparisonRange, formatMoneyWhole } from "@/features/dashboard/dashboard-format"
import { numberFormatter, pluralize } from "@/lib/format"
import { useAsyncResource, useMediaQuery } from "@/lib/hooks"
import { formatMoney } from "@/lib/money"
import type { PeriodRequest } from "@/lib/period"
import { toMessage } from "@/features/companies/form-errors"
import { cn } from "@/lib/utils"
import { getForecastReport, getFunnelReport, getSalesPerformance, type ForecastReport, type FunnelReport, type SalesPerformanceReport } from "./api"
import { FunnelChart } from "./report-charts"
import { ReportError, ReportLoading } from "./ReportStatus"
import { ReportPanel, deltaContextOf, formatDays, formatPercent, rateDelta, valueDelta } from "./report-ui"

export type ReportTab = "visao-geral" | "funil" | "desempenho" | "forecast" | "safras"

type Props = { request: PeriodRequest; periodName: string; onOpenTab: (tab: ReportTab) => void }

/**
 * O resumo executivo do período: os quatro números que decidem, o funil em miniatura, quem está na
 * frente e o que o pipeline promete. Não tem endpoint próprio — compõe os relatórios que as outras
 * abas já usam, e cada bloco leva para a aba onde ele é aprofundado.
 */
export function OverviewTab({ request, periodName, onOpenTab }: Props) {
  const requestKey = "days" in request ? `d:${request.days}` : `r:${request.from}:${request.to}`

  const resource = useAsyncResource(
    async (signal) =>
      Promise.all([
        getFunnelReport(request, signal),
        getSalesPerformance("owner", request, signal),
        getForecastReport(request, signal),
      ]),
    [requestKey],
    { keepPreviousData: true }
  )

  const error = resource.error ? toMessage(resource.error, "Não foi possível carregar a visão geral.") : null

  if (error && !resource.data) return <ReportError message={error} onRetry={() => resource.reload()} />
  if (!resource.data) return <ReportLoading />

  const [funnel, performance, forecast] = resource.data

  return (
    <div className={cn("flex flex-col gap-4 transition-opacity", resource.isLoading && "opacity-60")} aria-busy={resource.isLoading}>
      {error && <ReportError message={`${error} Mostrando os últimos números carregados.`} onRetry={() => resource.reload()} />}

      <OverviewKpis funnel={funnel} performance={performance} periodName={periodName} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ReportPanel
          id="overview-funnel-heading"
          title="O funil do período"
          subtitle={`Dos ${numberFormatter.format(funnel.cohortSize)} negócios que entraram · ${periodName}`}
          aside={<SeeAll onClick={() => onOpenTab("funil")}>Ver o funil</SeeAll>}
        >
          {funnel.cohortSize === 0 ? (
            <EmptyState compact title="Nenhum negócio entrou no funil" description="Amplie o período para ver o caminho da coorte." />
          ) : (
            <FunnelChart steps={funnel.funnel} />
          )}
        </ReportPanel>

        <div className="flex flex-col gap-4">
          <PodiumPanel performance={performance} periodName={periodName} onOpenTab={onOpenTab} />
          <ForecastSummaryPanel forecast={forecast} onOpenTab={onOpenTab} />
        </div>
      </div>
    </div>
  )
}

function OverviewKpis({
  funnel,
  performance,
  periodName,
}: {
  funnel: FunnelReport
  performance: SalesPerformanceReport
  periodName: string
}) {
  const period = funnel.period
  const comparison = comparisonRange(deltaContextOf(period))
  const isMobile = useMediaQuery("(max-width: 767px)")
  const golden = funnel.goldenMetric.callsPerFiveThousand

  const kpis = [
    {
      icon: CircleDollarSign,
      label: "Receita fechada",
      hint: `negócios ganhos, pela data de fechamento · ${periodName}`,
      value: formatMoneyWhole(performance.totals.revenue.current),
      delta: valueDelta(performance.totals.revenue, period),
    },
    {
      icon: Target,
      label: "Métrica de ouro",
      hint: `ligações, em média, para gerar R$ 5.000 · ${periodName}`,
      value: golden === null ? "—" : `${numberFormatter.format(Math.round(golden * 10) / 10)} lig.`,
      delta: rateDelta(golden, funnel.goldenMetric.previousCallsPerFiveThousand, period),
      polarity: "higher-is-worse" as const,
    },
    {
      icon: Filter,
      label: "Conversão da coorte",
      hint: `dos que entraram no período, quantos já foram ganhos · ${periodName}`,
      value: formatPercent(funnel.cohortConversionRate),
      delta: rateDelta(funnel.cohortConversionRate, funnel.previousCohortConversionRate, period),
    },
    {
      icon: Clock3,
      label: "Tempo até fechar",
      hint: `média da criação ao ganho · ${periodName}`,
      value: formatDays(funnel.timeToClose.averageDaysToClose),
      delta: rateDelta(funnel.timeToClose.averageDaysToClose, funnel.timeToClose.previousAverageDaysToClose, period),
      polarity: "higher-is-worse" as const,
    },
  ]

  const cards = kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} comparison={comparison} />)

  return isMobile ? (
    <KpiCarousel label="Indicadores do período">{cards}</KpiCarousel>
  ) : (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards}</div>
  )
}

function PodiumPanel({
  performance,
  periodName,
  onOpenTab,
}: {
  performance: SalesPerformanceReport
  periodName: string
  onOpenTab: (tab: ReportTab) => void
}) {
  const top = [...performance.groups].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 3)

  return (
    <ReportPanel
      id="overview-podium-heading"
      title="Quem está na frente"
      subtitle={`Por receita fechada · ${periodName}`}
      aside={<SeeAll onClick={() => onOpenTab("desempenho")}>Ver todos</SeeAll>}
    >
      {top.length === 0 ? (
        <EmptyState compact title="Nenhum fechamento no período" description="Ninguém fechou negócio nesta janela." />
      ) : (
        <ol className="flex flex-col gap-3">
          {top.map((group, index) => (
            <li key={group.groupKey} className="flex items-center gap-3">
              <span className={cn("w-4 font-mono text-2xs tabular", index === 0 ? "text-accent" : "text-faint")}>
                {index + 1}
              </span>
              <Monogram name={group.groupLabel} size="xs" className={cn(index === 0 && "border-accent/40 text-accent")} />
              <span className="min-w-0 flex-1 truncate text-sm text-fg">{group.groupLabel}</span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-medium text-fg tabular">{formatMoney(group.totalRevenue)}</span>
                <span className="block text-2xs text-muted tabular">
                  {pluralize(group.wonDeals, "ganho", "ganhos")} · {formatPercent(group.closeRate)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </ReportPanel>
  )
}

function ForecastSummaryPanel({ forecast, onOpenTab }: { forecast: ForecastReport; onOpenTab: (tab: ReportTab) => void }) {
  const share = forecast.totalPipelineAmount > 0 ? forecast.totalWeightedForecast / forecast.totalPipelineAmount : null

  return (
    <ReportPanel
      id="overview-forecast-heading"
      title="O que o pipeline promete"
      subtitle="Fotografia de hoje — não depende do período"
      aside={<SeeAll onClick={() => onOpenTab("forecast")}>Ver forecast</SeeAll>}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="label-mono text-muted">Em aberto</p>
            <p className="font-display text-xl font-semibold text-fg tabular">{formatMoneyWhole(forecast.totalPipelineAmount)}</p>
          </div>
          <ArrowRight aria-hidden="true" className="mb-1.5 size-4 text-faint" />
          <div className="text-right">
            <p className="label-mono text-accent">Ponderado</p>
            <p className="font-display text-xl font-semibold text-accent tabular">
              {formatMoneyWhole(forecast.totalWeightedForecast)}
            </p>
          </div>
        </div>
        <span className="block h-1.5 w-full bg-surface-3" aria-hidden="true">
          <span className="block h-full bg-accent" style={{ width: `${(share ?? 0) * 100}%` }} />
        </span>
        <p className="text-xs text-muted">
          {share === null
            ? "Sem pipeline aberto para projetar."
            : `${formatPercent(share)} do pipeline, pela probabilidade histórica de cada etapa · ${pluralize(forecast.totalOpenDeals, "negócio em aberto", "negócios em aberto")}`}
        </p>
      </div>
    </ReportPanel>
  )
}
