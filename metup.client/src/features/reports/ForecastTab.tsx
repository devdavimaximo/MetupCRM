import { CalendarClock, CircleDollarSign, Layers, Scale } from "lucide-react"

import { KpiCard, KpiCarousel } from "@/components/metrics/KpiCard"
import { EmptyState } from "@/components/ui/states"
import { Table, TableBody, TableCell, TableHeader, TableRow, TableRowHeader } from "@/components/ui/table"
import { formatMoneyWhole } from "@/features/dashboard/dashboard-format"
import { stageLabels } from "@/features/deals/stage-labels"
import { numberFormatter, pluralize } from "@/lib/format"
import { useMediaQuery } from "@/lib/hooks"
import { formatMoney } from "@/lib/money"
import type { PeriodRequest } from "@/lib/period"
import { cn } from "@/lib/utils"
import { getForecastReport, type ForecastByStage, type ForecastReport } from "./api"
import { ExportCsvButton } from "./ExportCsvButton"
import { ForecastOutlookChart, ForecastWaterfall, formatMonthKey } from "./report-charts"
import { ReportError, ReportLoading } from "./ReportStatus"
import { ChartLegend, ReportPanel, ReportTablePanel, formatPercent } from "./report-ui"
import { SortableHead, useTableSort } from "./table-sort"
import { useReport } from "./useReport"

type Props = { request: PeriodRequest }

/**
 * Forecast (V3, seção 7 do CLAUDE.md). É o único relatório que olha para frente: a fotografia do
 * pipeline aberto de hoje, ponderada pela probabilidade histórica de cada etapa. Por isso ele não
 * obedece ao período da tela — e a UI diz isso, em vez de deixar o filtro mentir.
 */
export function ForecastTab({ request }: Props) {
  const { report, isLoading, error, retry } = useReport(getForecastReport, request, "Não foi possível carregar o forecast.")

  if (error && !report) return <ReportError message={error} onRetry={() => retry()} />
  if (!report) return <ReportLoading />

  const weightedShare = report.totalPipelineAmount > 0 ? report.totalWeightedForecast / report.totalPipelineAmount : null

  return (
    <div className={cn("flex flex-col gap-4 transition-opacity", isLoading && "opacity-60")} aria-busy={isLoading}>
      {error && <ReportError message={`${error} Mostrando os últimos números carregados.`} onRetry={() => retry()} />}

      <ForecastKpis report={report} weightedShare={weightedShare} />

      {report.totalOpenDeals === 0 ? (
        <ReportPanel id="forecast-empty-heading" title="Pipeline aberto" subtitle="Fotografia de hoje">
          <EmptyState
            compact
            title="Nada em aberto para projetar"
            description="Todos os negócios estão fechados. Assim que entrar negócio novo no funil, a projeção aparece aqui."
          />
        </ReportPanel>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <ReportPanel
              id="forecast-stage-heading"
              title="Onde está o dinheiro"
              subtitle="Valor em aberto por etapa, e quanto dele o histórico sustenta"
              aside={
                <ChartLegend
                  items={[
                    { label: "Ponderado", color: "var(--color-accent)" },
                    { label: "Resto em aberto", color: "var(--color-surface-3)", muted: true },
                  ]}
                />
              }
              bodyClassName="h-64"
            >
              <ForecastWaterfall byStage={report.byStage} />
            </ReportPanel>

            <ReportPanel
              id="forecast-month-heading"
              title="Quando promete fechar"
              subtitle="Pela previsão que o responsável informou em cada negócio"
              aside={
                report.openDealsWithoutExpectedCloseDate > 0 ? (
                  <p className="shrink-0 text-2xs text-muted">
                    {pluralize(report.openDealsWithoutExpectedCloseDate, "negócio sem previsão", "negócios sem previsão")}
                  </p>
                ) : undefined
              }
              bodyClassName="h-64"
            >
              <ForecastOutlookChart byMonth={report.byMonth} />
            </ReportPanel>
          </div>

          <ForecastTable report={report} />
        </>
      )}
    </div>
  )
}

function ForecastKpis({ report, weightedShare }: { report: ForecastReport; weightedShare: number | null }) {
  const isMobile = useMediaQuery("(max-width: 767px)")
  const withoutDate = report.openDealsWithoutExpectedCloseDate

  const kpis = [
    {
      icon: Layers,
      label: "Pipeline aberto",
      hint: "soma do valor efetivo dos negócios em aberto hoje",
      value: formatMoneyWhole(report.totalPipelineAmount),
      delta: { kind: "idle" } as const,
      caption: pluralize(report.totalOpenDeals, "negócio em aberto", "negócios em aberto"),
    },
    {
      icon: CircleDollarSign,
      label: "Receita ponderada",
      hint: "pipeline aberto ponderado pela probabilidade histórica de ganho de cada etapa",
      value: formatMoneyWhole(report.totalWeightedForecast),
      delta: { kind: "idle" } as const,
      caption: weightedShare === null ? "sem base para ponderar" : `${formatPercent(weightedShare)} do pipeline`,
    },
    {
      icon: Scale,
      label: "Etapas com histórico",
      hint: "etapas que já tiveram negócios fechados o bastante para sustentar uma probabilidade",
      value: `${report.byStage.filter((s) => s.winProbability !== null).length}/${report.byStage.length}`,
      delta: { kind: "idle" } as const,
      caption: "o resto entra sem ponderação",
    },
    {
      icon: CalendarClock,
      label: "Sem previsão",
      hint: "negócios em aberto sem data prevista de fechamento preenchida",
      value: numberFormatter.format(withoutDate),
      delta: { kind: "idle" } as const,
      tone: withoutDate > 0 ? ("danger" as const) : undefined,
      caption: withoutDate > 0 ? "ficam fora do calendário de fechamento" : "todos com data prevista",
    },
  ]

  const cards = kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} comparison="" />)

  return isMobile ? (
    <KpiCarousel label="Indicadores do forecast">{cards}</KpiCarousel>
  ) : (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards}</div>
  )
}

type Column = "stage" | "count" | "amount" | "probability" | "weighted"

function ForecastTable({ report }: { report: ForecastReport }) {
  const { sort, sorted, toggle } = useTableSort<ForecastByStage, Column>(
    report.byStage,
    {
      stage: (row) => stageLabels[row.stage],
      count: (row) => row.openDealsCount,
      amount: (row) => row.openAmount,
      probability: (row) => row.winProbability,
      weighted: (row) => row.weightedAmount,
    },
    { key: "weighted", direction: "desc" }
  )

  return (
    <ReportTablePanel
      id="forecast-table-heading"
      title="Pipeline por etapa"
      subtitle="Valor bruto em aberto × valor ponderado pela probabilidade histórica"
      aside={
        <ExportCsvButton
          report="forecast"
          period={report.period}
          rows={sorted}
          columns={[
            { header: "Etapa", value: (row) => stageLabels[row.stage] },
            { header: "Negócios", value: (row) => row.openDealsCount },
            { header: "Valor em aberto", value: (row) => row.openAmount },
            { header: "Probabilidade histórica", value: (row) => row.winProbability },
            { header: "Valor ponderado", value: (row) => row.weightedAmount },
          ]}
        />
      }
    >
      <Table minWidth="640px">
        <TableHeader>
          <tr>
            <SortableHead columnKey="stage" sort={sort} onSort={toggle}>
              Etapa
            </SortableHead>
            <SortableHead columnKey="count" sort={sort} onSort={toggle} numeric>
              Negócios
            </SortableHead>
            <SortableHead columnKey="amount" sort={sort} onSort={toggle} numeric>
              Em aberto
            </SortableHead>
            <SortableHead columnKey="probability" sort={sort} onSort={toggle} numeric>
              Prob. histórica
            </SortableHead>
            <SortableHead columnKey="weighted" sort={sort} onSort={toggle} numeric>
              Ponderado
            </SortableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => (
            <TableRow key={row.stage}>
              <TableRowHeader>{stageLabels[row.stage]}</TableRowHeader>
              <TableCell numeric>{numberFormatter.format(row.openDealsCount)}</TableCell>
              <TableCell numeric>{formatMoney(row.openAmount)}</TableCell>
              <TableCell numeric>
                {row.winProbability === null ? (
                  <span className="text-faint" title="Sem negócios fechados que passaram por esta etapa">
                    sem histórico
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-end gap-2.5">
                    <span className="hidden h-1 w-12 bg-surface-3 md:block" aria-hidden="true">
                      <span className="block h-full bg-fg-muted" style={{ width: `${row.winProbability * 100}%` }} />
                    </span>
                    {formatPercent(row.winProbability)}
                  </span>
                )}
              </TableCell>
              <TableCell numeric className="font-medium text-fg">
                {row.weightedAmount === null ? <span className="text-faint">—</span> : formatMoney(row.weightedAmount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <tfoot className="border-t border-line-soft">
          <tr>
            <TableRowHeader className="text-muted">Total</TableRowHeader>
            <TableCell numeric>{numberFormatter.format(report.totalOpenDeals)}</TableCell>
            <TableCell numeric>{formatMoney(report.totalPipelineAmount)}</TableCell>
            <TableCell numeric>
              <span className="text-faint">—</span>
            </TableCell>
            <TableCell numeric className="font-medium text-accent">
              {formatMoney(report.totalWeightedForecast)}
            </TableCell>
          </tr>
        </tfoot>
      </Table>
      <p className="px-5 pt-2 text-2xs text-faint">
        Meses vencidos com negócio ainda aberto aparecem em vermelho no gráfico ao lado — o balde "
        {formatMonthKey(null)}" reúne quem está sem data prevista.
      </p>
    </ReportTablePanel>
  )
}
