import { ArrowRight, Clock3, Filter, PhoneCall, Target } from "lucide-react"

import { KpiCard, KpiCarousel } from "@/components/metrics/KpiCard"
import { EmptyState } from "@/components/ui/states"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { comparisonRange, countDelta, formatMoneyWhole } from "@/features/dashboard/dashboard-format"
import { stageLabels } from "@/features/deals/stage-labels"
import { numberFormatter, pluralize } from "@/lib/format"
import type { PeriodRequest } from "@/lib/period"
import { useMediaQuery } from "@/lib/hooks"
import { cn } from "@/lib/utils"
import { getFunnelReport, type FunnelReport } from "./api"
import { ExportCsvButton } from "./ExportCsvButton"
import { FunnelChart, TimeToCloseHistogram } from "./report-charts"
import { ReportError, ReportLoading } from "./ReportStatus"
import {
  ReportPanel,
  ReportTablePanel,
  deltaContextOf,
  formatDays,
  formatPercent,
  rateDelta,
  valueDelta,
} from "./report-ui"
import { useReport } from "./useReport"

type Props = { request: PeriodRequest; periodName: string }

/**
 * O funil do período (V3, seção 7 do CLAUDE.md). A tela responde, de cima para baixo: quanto
 * esforço custou o resultado (a métrica de ouro), por onde a coorte que entrou passou e onde
 * travou, e quanto tempo levou para fechar.
 */
export function FunnelTab({ request, periodName }: Props) {
  const { report, isLoading, error, retry } = useReport(getFunnelReport, request, "Não foi possível carregar o relatório de funil.")

  if (error && !report) return <ReportError message={error} onRetry={() => retry()} />
  if (!report) return <ReportLoading />

  return (
    <div className={cn("flex flex-col gap-4 transition-opacity", isLoading && "opacity-60")} aria-busy={isLoading}>
      {error && <ReportError message={`${error} Mostrando os últimos números carregados.`} onRetry={() => retry()} />}

      <GoldenMetricCard report={report} periodName={periodName} />

      <FunnelKpis report={report} periodName={periodName} />

      <ReportPanel
        id="funnel-steps-heading"
        title="Caminho da coorte"
        subtitle={`Dos ${numberFormatter.format(report.cohortSize)} negócios que entraram no funil · ${periodName}`}
        aside={
          <p className="hidden text-2xs text-faint sm:block">
            alcançaram a etapa · % do topo · tempo médio parado
          </p>
        }
      >
        {report.cohortSize === 0 ? (
          <EmptyState
            compact
            title="Nenhum negócio entrou no funil"
            description="Ninguém foi cadastrado neste período. Amplie o período ou cadastre os prospects da semana."
          />
        ) : (
          <FunnelChart steps={report.funnel} />
        )}
      </ReportPanel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <TimeToClosePanel report={report} periodName={periodName} />
        <StageConversionsPanel report={report} periodName={periodName} />
      </div>
    </div>
  )
}

/** A métrica de ouro (CLAUDE.md §2): o único número dourado da tela, de propósito. */
function GoldenMetricCard({ report, periodName }: { report: FunnelReport; periodName: string }) {
  const { goldenMetric: golden, period } = report
  const value = golden.callsPerFiveThousand
  // Menos ligações por R$ 5.000 é melhor: a seta para baixo aqui é boa notícia.
  const delta = countDelta(value ?? 0, golden.previousCallsPerFiveThousand)

  return (
    <section
      aria-labelledby="golden-metric-heading"
      className="relative overflow-hidden rounded-lg border border-line-soft bg-linear-to-b from-surface-2/70 to-surface lg:grid lg:grid-cols-[minmax(0,1fr)_auto]"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 size-96 bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-accent)_14%,transparent),transparent)]"
      />
      <div className="relative flex flex-col gap-3 px-6 py-7 sm:px-8">
        <h2 id="golden-metric-heading" className="label-mono flex items-center gap-2.5 text-accent">
          <span aria-hidden="true" className="h-px w-5 bg-accent" />A métrica de ouro
        </h2>
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-display text-4xl font-semibold tracking-[-0.03em] text-accent tabular">
            {value === null ? "—" : numberFormatter.format(Math.round(value * 10) / 10)}
          </span>
          {value !== null && <span className="font-display text-xl text-fg">ligações</span>}
        </p>
        <p className="text-base text-fg-muted">
          {value === null
            ? "Sem receita fechada no período para calcular."
            : "em média, para gerar R$ 5.000 em vendas."}
        </p>
        {value !== null && golden.previousCallsPerFiveThousand !== null && delta.kind === "change" && (
          <p className={cn("text-sm tabular", delta.direction === "down" ? "text-success" : delta.direction === "up" ? "text-danger" : "text-muted")}>
            {delta.direction === "down" ? "↓" : delta.direction === "up" ? "↑" : "→"} {delta.label} vs. o período anterior
            <span className="text-muted"> — menos ligações por venda é melhor</span>
          </p>
        )}
      </div>
      <div className="relative grid border-t border-line-soft sm:grid-cols-2 lg:grid-cols-1 lg:border-t-0 lg:border-l">
        <GoldenSide
          className="border-b border-line-soft sm:border-r sm:border-b-0 lg:border-r-0 lg:border-b"
          label="Ligações"
          value={numberFormatter.format(golden.calls.current)}
          caption={`registradas · ${periodName}`}
        />
        <GoldenSide
          label="Receita fechada"
          value={formatMoneyWhole(golden.closedRevenue.current)}
          caption={
            period.historyStart === null
              ? "no período"
              : `anterior: ${formatMoneyWhole(golden.closedRevenue.previous)}`
          }
        />
      </div>
    </section>
  )
}

function GoldenSide({ label, value, caption, className }: { label: string; value: string; caption: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5 px-5 py-5 sm:px-6", className)}>
      <p className="label-mono text-muted">{label}</p>
      <p className="font-display text-2xl font-semibold tracking-[-0.02em] text-fg tabular">{value}</p>
      <p className="text-xs text-muted">{caption}</p>
    </div>
  )
}

function FunnelKpis({ report, periodName }: { report: FunnelReport; periodName: string }) {
  const { period, timeToClose } = report
  const comparison = comparisonRange(deltaContextOf(period))
  const isMobile = useMediaQuery("(max-width: 767px)")

  const kpis = [
    {
      icon: Target,
      label: "Entraram no funil",
      hint: `negócios criados · ${periodName}`,
      value: numberFormatter.format(report.cohortSize),
      delta: { kind: "no-base" } as const,
      caption: pluralize(report.lostCount, "perdido até agora", "perdidos até agora"),
    },
    {
      icon: Filter,
      label: "Conversão da coorte",
      hint: `dos que entraram no período, quantos já foram ganhos · ${periodName}`,
      value: formatPercent(report.cohortConversionRate),
      delta: rateDelta(report.cohortConversionRate, report.previousCohortConversionRate, period),
    },
    {
      icon: PhoneCall,
      label: "Ligações",
      hint: `ligações registradas · ${periodName}`,
      value: numberFormatter.format(report.goldenMetric.calls.current),
      delta: valueDelta(report.goldenMetric.calls, period),
    },
    {
      icon: Clock3,
      label: "Tempo até fechar",
      hint: `média da criação ao ganho, nos negócios ganhos · ${periodName}`,
      value: formatDays(timeToClose.averageDaysToClose),
      // Fechar mais rápido é melhor: a seta para baixo é boa notícia.
      delta: rateDelta(timeToClose.averageDaysToClose, timeToClose.previousAverageDaysToClose, period),
      polarity: "higher-is-worse" as const,
    },
  ]

  const cards = kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} comparison={comparison} />)

  return isMobile ? (
    <KpiCarousel label="Indicadores do funil">{cards}</KpiCarousel>
  ) : (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards}</div>
  )
}

function TimeToClosePanel({ report, periodName }: { report: FunnelReport; periodName: string }) {
  const { timeToClose } = report
  const hasData = timeToClose.wonDealsCount > 0

  return (
    <ReportPanel
      id="time-to-close-heading"
      title="Tempo até fechar"
      subtitle={`Distribuição dos ${numberFormatter.format(timeToClose.wonDealsCount)} negócios ganhos · ${periodName}`}
      aside={
        hasData ? (
          <p className="shrink-0 text-right">
            <span className="block font-display text-lg font-semibold text-fg tabular">
              {formatDays(timeToClose.averageDaysToClose)}
            </span>
            <span className="block text-2xs text-muted">em média</span>
          </p>
        ) : undefined
      }
      bodyClassName="h-56"
    >
      {hasData ? (
        <TimeToCloseHistogram distribution={timeToClose.distribution} average={timeToClose.averageDaysToClose} />
      ) : (
        <EmptyState
          compact
          title="Nenhum negócio ganho no período"
          description="Sem fechamento não há tempo até fechar para medir."
        />
      )}
    </ReportPanel>
  )
}

function StageConversionsPanel({ report, periodName }: { report: FunnelReport; periodName: string }) {
  const rows = report.stageConversions

  return (
    <ReportTablePanel
      id="conversion-heading"
      title="Transições registradas"
      subtitle={`Movimentos de estágio da coorte · ${periodName}`}
      aside={
        <ExportCsvButton
          report="transicoes"
          period={report.period}
          rows={rows}
          columns={[
            { header: "De", value: (row) => stageLabels[row.fromStage] },
            { header: "Para", value: (row) => stageLabels[row.toStage] },
            { header: "Negócios", value: (row) => row.count },
          ]}
        />
      }
    >
      {rows.length === 0 ? (
        <EmptyState compact title="Nenhuma mudança de estágio" description="Nenhuma transição registrada no período." />
      ) : (
        <div className="max-h-56 overflow-y-auto">
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Transição</TableHead>
                <TableHead numeric>Negócios</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {rows.map((conversion) => (
                <TableRow key={`${conversion.fromStage}-${conversion.toStage}`}>
                  <TableCell>
                    <span className="flex items-center gap-2 text-fg">
                      <span className="text-fg-muted">{stageLabels[conversion.fromStage]}</span>
                      <ArrowRight className="size-3.5 text-faint" aria-label="para" />
                      {stageLabels[conversion.toStage]}
                    </span>
                  </TableCell>
                  <TableCell numeric className="font-medium text-fg">
                    {numberFormatter.format(conversion.count)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ReportTablePanel>
  )
}

