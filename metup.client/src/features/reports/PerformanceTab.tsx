import { useState } from "react"
import { CircleDollarSign, Filter, Trophy, Wallet } from "lucide-react"

import { KpiCard, KpiCarousel } from "@/components/metrics/KpiCard"
import { Monogram } from "@/components/ui/monogram"
import { SegmentedControl } from "@/components/ui/segmented"
import { EmptyState } from "@/components/ui/states"
import { Table, TableBody, TableCell, TableHeader, TableRow, TableRowHeader } from "@/components/ui/table"
import { comparisonRange, formatMoneyWhole } from "@/features/dashboard/dashboard-format"
import type { DealSource } from "@/features/deals/api"
import { sourceLabels } from "@/features/deals/stage-labels"
import { numberFormatter } from "@/lib/format"
import { useMediaQuery } from "@/lib/hooks"
import { formatMoney } from "@/lib/money"
import type { PeriodRequest } from "@/lib/period"
import { cn } from "@/lib/utils"
import { getSalesPerformance, type PerformanceAxis, type SalesPerformanceGroup, type SalesPerformanceReport } from "./api"
import { ExportCsvButton } from "./ExportCsvButton"
import { GroupPerformanceChart } from "./report-charts"
import { ReportError, ReportLoading } from "./ReportStatus"
import {
  ReportPanel,
  ReportTablePanel,
  closeRateTone,
  deltaContextOf,
  formatPercent,
  valueDelta,
} from "./report-ui"
import { SortableHead, useTableSort } from "./table-sort"
import { useReport } from "./useReport"

type Props = { request: PeriodRequest; periodName: string }

const AXES: { value: PerformanceAxis; label: string }[] = [
  { value: "owner", label: "Responsáveis" },
  { value: "segment", label: "Segmentos" },
  { value: "source", label: "Origens" },
]

const AXIS_COPY: Record<PerformanceAxis, { column: string; title: string; subtitle: string; empty: string; file: string }> = {
  owner: {
    column: "Responsável",
    title: "Desempenho por responsável",
    subtitle: "Quem fechou quanto, com que eficiência, e o que ainda carrega em aberto",
    empty: "Nenhum negócio com responsável no período.",
    file: "desempenho-responsaveis",
  },
  segment: {
    column: "Segmento",
    title: "Desempenho por segmento",
    subtitle: "Em que tipo de empresa a operação converte melhor",
    empty: "Nenhum negócio de empresa com segmento no período.",
    file: "desempenho-segmentos",
  },
  source: {
    column: "Origem",
    title: "Desempenho por origem",
    subtitle: "De onde vem o negócio que fecha — não só o que entra",
    empty: "Nenhum negócio no período.",
    file: "desempenho-origens",
  },
}

/** A origem vem do servidor como o nome do enum; o pt-br é da UI (seção 8 do CLAUDE.md). */
function labelOf(group: SalesPerformanceGroup, axis: PerformanceAxis) {
  return axis === "source" ? (sourceLabels[group.groupKey as DealSource] ?? group.groupLabel) : group.groupLabel
}

/**
 * Desempenho comercial por eixo (V3, seção 7 do CLAUDE.md). Responsável, segmento e origem são a
 * mesma pergunta feita a três recortes — por isso uma aba só, com o eixo no comando, em vez de três
 * abas idênticas. O ranking vem junto porque é a leitura ordenada dos mesmos números.
 */
export function PerformanceTab({ request, periodName }: Props) {
  const [axis, setAxis] = useState<PerformanceAxis>("owner")
  const { report, isLoading, error, retry } = useReport(
    (periodRequest, signal) => getSalesPerformance(axis, periodRequest, signal),
    request,
    "Não foi possível carregar o desempenho.",
    axis
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl label="Eixo do relatório" options={AXES} value={axis} onChange={setAxis} />
        <p className="text-xs text-faint">Fechamentos e receita contam pela data de fechamento; o pipeline aberto é de hoje.</p>
      </div>

      <PerformanceBody
        axis={axis}
        periodName={periodName}
        report={report}
        isLoading={isLoading}
        error={error}
        onRetry={retry}
      />
    </div>
  )
}

function PerformanceBody({
  axis,
  periodName,
  report,
  isLoading,
  error,
  onRetry,
}: {
  axis: PerformanceAxis
  periodName: string
  report: SalesPerformanceReport | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
}) {
  if (error && !report) return <ReportError message={error} onRetry={onRetry} />
  if (!report) return <ReportLoading />

  const copy = AXIS_COPY[axis]
  const groups = report.groups.map((group) => ({ ...group, groupLabel: labelOf(group, axis) }))
  const ranked = [...groups].sort((a, b) => b.totalRevenue - a.totalRevenue)

  return (
    <div className={cn("flex flex-col gap-4 transition-opacity", isLoading && "opacity-60")} aria-busy={isLoading}>
      {error && <ReportError message={`${error} Mostrando os últimos números carregados.`} onRetry={onRetry} />}

      <PerformanceKpis report={report} periodName={periodName} />

      {groups.length === 0 ? (
        <ReportPanel id="performance-empty-heading" title={copy.title} subtitle={periodName}>
          <EmptyState compact title="Sem dados no período" description={copy.empty} />
        </ReportPanel>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <ReportPanel
              id="performance-chart-heading"
              title={copy.title}
              subtitle={`${copy.subtitle} · ${periodName}`}
              aside={
                <p className="hidden shrink-0 text-2xs text-faint sm:block">
                  barra: receita · linha: taxa de fechamento
                </p>
              }
              bodyClassName="h-64"
            >
              <GroupPerformanceChart groups={groups} />
            </ReportPanel>

            <RankingPanel groups={ranked} periodName={periodName} column={copy.column} />
          </div>

          <PerformanceTable report={report} groups={groups} copy={copy} periodName={periodName} />
        </>
      )}
    </div>
  )
}

function PerformanceKpis({ report, periodName }: { report: SalesPerformanceReport; periodName: string }) {
  const { totals, period } = report
  const comparison = comparisonRange(deltaContextOf(period))
  const isMobile = useMediaQuery("(max-width: 767px)")

  const previousWon = report.groups.reduce((sum, group) => sum + group.previousWonDeals, 0)

  const kpis = [
    {
      icon: CircleDollarSign,
      label: "Receita fechada",
      hint: `negócios ganhos no período, pela data de fechamento · ${periodName}`,
      value: formatMoneyWhole(totals.revenue.current),
      delta: valueDelta(totals.revenue, period),
    },
    {
      icon: Trophy,
      label: "Negócios ganhos",
      hint: `fechados como ganho · ${periodName}`,
      value: numberFormatter.format(totals.wonDeals),
      delta: valueDelta({ current: totals.wonDeals, previous: previousWon }, period),
    },
    {
      // A taxa do período anterior exigiria também os perdidos de lá, que o relatório não traz por
      // grupo: aqui a taxa aparece sem delta, em vez de comparar com um número incompleto.
      icon: Filter,
      label: "Taxa de fechamento",
      hint: `ganhos ÷ (ganhos + perdidos) · ${periodName}`,
      value: formatPercent(totals.closeRate),
      delta: { kind: "idle" } as const,
    },
    {
      icon: Wallet,
      label: "Pipeline aberto",
      hint: "valor em aberto hoje, somando todos os grupos — não depende do período",
      value: formatMoneyWhole(totals.openAmount),
      delta: { kind: "idle" } as const,
      caption: `${numberFormatter.format(totals.openDeals)} em aberto`,
    },
  ]

  const cards = kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} comparison={comparison} />)

  return isMobile ? (
    <KpiCarousel label="Indicadores de desempenho">{cards}</KpiCarousel>
  ) : (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards}</div>
  )
}

/** Quem está na frente, e a que distância — a mesma leitura da tabela, ordenada e com a barra. */
function RankingPanel({ groups, periodName, column }: { groups: SalesPerformanceGroup[]; periodName: string; column: string }) {
  const leader = Math.max(0, groups[0]?.totalRevenue ?? 0)

  return (
    <ReportPanel id="ranking-heading" title="Ranking por receita" subtitle={periodName} bodyClassName="overflow-hidden">
      <ol className="flex flex-col gap-2.5">
        {groups.slice(0, 6).map((group, index) => {
          const position = index + 1
          const share = leader > 0 ? Math.max(0, group.totalRevenue) / leader : 0

          return (
            <li key={group.groupKey} className="flex items-center gap-3">
              <span
                className={cn(
                  "w-5 shrink-0 font-mono text-2xs tabular",
                  position === 1 ? "text-accent" : position <= 3 ? "text-fg" : "text-faint"
                )}
              >
                {String(position).padStart(2, "0")}
              </span>
              <Monogram name={group.groupLabel} size="xs" className={cn(position === 1 && "border-accent/40 text-accent")} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm text-fg">{group.groupLabel}</span>
                  <span className="shrink-0 text-sm font-medium text-fg tabular">{formatMoney(group.totalRevenue)}</span>
                </div>
                <span className="block h-1 w-full bg-surface-3" aria-hidden="true">
                  <span
                    className={cn("block h-full", position === 1 ? "bg-accent" : "bg-fg-muted/60")}
                    style={{ width: `${share * 100}%` }}
                  />
                </span>
              </div>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-2xs text-faint">
        {groups.length > 6 ? `Os 6 primeiros de ${numberFormatter.format(groups.length)} — a tabela abaixo traz todos.` : `${column} ordenados por receita fechada.`}
      </p>
    </ReportPanel>
  )
}

type Column = "label" | "open" | "won" | "lost" | "closeRate" | "ticket" | "revenue" | "delta"

function PerformanceTable({
  report,
  groups,
  copy,
  periodName,
}: {
  report: SalesPerformanceReport
  groups: SalesPerformanceGroup[]
  copy: (typeof AXIS_COPY)[PerformanceAxis]
  periodName: string
}) {
  const { sort, sorted, toggle } = useTableSort<SalesPerformanceGroup, Column>(
    groups,
    {
      label: (row) => row.groupLabel,
      open: (row) => row.openDeals,
      won: (row) => row.wonDeals,
      lost: (row) => row.lostDeals,
      closeRate: (row) => row.closeRate,
      ticket: (row) => row.averageTicket,
      revenue: (row) => row.totalRevenue,
      delta: (row) => row.totalRevenue - row.previousRevenue,
    },
    { key: "revenue", direction: "desc" }
  )

  return (
    <ReportTablePanel
      id="performance-table-heading"
      title="Todos os números"
      subtitle={periodName}
      aside={
        <ExportCsvButton
          report={copy.file}
          period={report.period}
          rows={sorted}
          columns={[
            { header: copy.column, value: (row) => row.groupLabel },
            { header: "Em aberto", value: (row) => row.openDeals },
            { header: "Valor em aberto", value: (row) => row.openAmount },
            { header: "Ganhos", value: (row) => row.wonDeals },
            { header: "Perdidos", value: (row) => row.lostDeals },
            { header: "Taxa de fechamento", value: (row) => row.closeRate },
            { header: "Ticket médio", value: (row) => row.averageTicket },
            { header: "Receita fechada", value: (row) => row.totalRevenue },
            { header: "Receita no período anterior", value: (row) => row.previousRevenue },
          ]}
        />
      }
    >
      <Table minWidth="860px">
        <TableHeader>
          <tr>
            <SortableHead columnKey="label" sort={sort} onSort={toggle}>
              {copy.column}
            </SortableHead>
            <SortableHead columnKey="open" sort={sort} onSort={toggle} numeric>
              Abertos
            </SortableHead>
            <SortableHead columnKey="won" sort={sort} onSort={toggle} numeric>
              Ganhos
            </SortableHead>
            <SortableHead columnKey="lost" sort={sort} onSort={toggle} numeric>
              Perdidos
            </SortableHead>
            <SortableHead columnKey="closeRate" sort={sort} onSort={toggle} numeric>
              Fechamento
            </SortableHead>
            <SortableHead columnKey="ticket" sort={sort} onSort={toggle} numeric>
              Ticket médio
            </SortableHead>
            <SortableHead columnKey="revenue" sort={sort} onSort={toggle} numeric>
              Receita
            </SortableHead>
            <SortableHead columnKey="delta" sort={sort} onSort={toggle} numeric>
              vs. anterior
            </SortableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {sorted.map((group) => (
            <TableRow key={group.groupKey}>
              <TableRowHeader>{group.groupLabel}</TableRowHeader>
              <TableCell numeric>{numberFormatter.format(group.openDeals)}</TableCell>
              <TableCell numeric>{numberFormatter.format(group.wonDeals)}</TableCell>
              <TableCell numeric>{numberFormatter.format(group.lostDeals)}</TableCell>
              <TableCell numeric className={cn("font-medium", closeRateTone(group.closeRate))}>
                {formatPercent(group.closeRate)}
              </TableCell>
              <TableCell numeric>{formatMoney(group.averageTicket)}</TableCell>
              <TableCell numeric className="font-medium text-fg">
                {formatMoney(group.totalRevenue)}
              </TableCell>
              <RevenueDeltaCell current={group.totalRevenue} previous={group.previousRevenue} />
            </TableRow>
          ))}
        </TableBody>
        <tfoot className="border-t border-line-soft">
          <tr>
            <TableRowHeader className="text-muted">Total</TableRowHeader>
            <TableCell numeric>{numberFormatter.format(report.totals.openDeals)}</TableCell>
            <TableCell numeric>{numberFormatter.format(report.totals.wonDeals)}</TableCell>
            <TableCell numeric>{numberFormatter.format(report.totals.lostDeals)}</TableCell>
            <TableCell numeric className={cn("font-medium", closeRateTone(report.totals.closeRate))}>
              {formatPercent(report.totals.closeRate)}
            </TableCell>
            <TableCell numeric>{formatMoney(report.totals.averageTicket)}</TableCell>
            <TableCell numeric className="font-medium text-fg">
              {formatMoney(report.totals.revenue.current)}
            </TableCell>
            <RevenueDeltaCell current={report.totals.revenue.current} previous={report.totals.revenue.previous} />
          </tr>
        </tfoot>
      </Table>
    </ReportTablePanel>
  )
}

/** A diferença de receita em dinheiro — o número que o gestor procura, não um percentual solto. */
function RevenueDeltaCell({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous

  return (
    <TableCell numeric className={cn(diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "text-muted")}>
      {previous === 0 && current === 0 ? (
        <span className="text-faint">—</span>
      ) : (
        `${diff > 0 ? "+" : diff < 0 ? "−" : ""}${formatMoney(Math.abs(diff))}`
      )}
    </TableCell>
  )
}
