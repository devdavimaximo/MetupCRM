import { EmptyState } from "@/components/ui/states"
import { Table, TableBody, TableCell, TableHeader, TableRow, TableRowHeader } from "@/components/ui/table"
import { numberFormatter } from "@/lib/format"
import { formatMoney } from "@/lib/money"
import type { PeriodRequest } from "@/lib/period"
import { cn } from "@/lib/utils"
import { getCohortReport, type CohortGroup, type CohortReport } from "./api"
import { ExportCsvButton } from "./ExportCsvButton"
import { CohortHeatmap, CohortTrendChart, formatCohortLabel } from "./report-charts"
import { ReportError, ReportLoading } from "./ReportStatus"
import { ChartLegend, ReportPanel, ReportTablePanel, closeRateTone, formatDays, formatPercent } from "./report-ui"
import { SortableHead, useTableSort } from "./table-sort"
import { useReport } from "./useReport"

type Props = { request: PeriodRequest; periodName: string }

/**
 * Safras (V3, seção 7 do CLAUDE.md): os negócios agrupados pelo mês em que entraram no funil. É o
 * único relatório em que o tempo é o eixo, e não o filtro — a pergunta é se a operação está
 * ficando melhor, safra após safra.
 */
export function CohortsTab({ request, periodName }: Props) {
  const { report, isLoading, error, retry } = useReport(getCohortReport, request, "Não foi possível carregar as safras.")

  if (error && !report) return <ReportError message={error} onRetry={() => retry()} />
  if (!report) return <ReportLoading />

  if (report.cohorts.length === 0) {
    return (
      <ReportPanel id="cohorts-empty-heading" title="Safras" subtitle={periodName}>
        <EmptyState
          compact
          title="Nenhuma safra no período"
          description="Nenhum negócio entrou no funil nesta janela. Amplie o período para comparar safras."
        />
      </ReportPanel>
    )
  }

  return (
    <div className={cn("flex flex-col gap-4 transition-opacity", isLoading && "opacity-60")} aria-busy={isLoading}>
      {error && <ReportError message={`${error} Mostrando os últimos números carregados.`} onRetry={() => retry()} />}

      <ReportPanel
        id="cohorts-trend-heading"
        title="Safras mês a mês"
        subtitle={`Negócios por mês de entrada no funil · ${periodName}`}
        aside={
          <ChartLegend
            items={[
              { label: "Ganhos", color: "var(--color-success)" },
              { label: "Perdidos", color: "var(--color-danger)" },
              { label: "Em aberto", color: "var(--color-surface-3)", muted: true },
            ]}
          />
        }
        bodyClassName="h-72"
      >
        <CohortTrendChart cohorts={report.cohorts} />
      </ReportPanel>

      <ReportPanel
        id="cohorts-heatmap-heading"
        title="Fechamento por safra"
        subtitle="Quanto mais dourada a célula, melhor a safra converteu — safra sem negócio fechado fica vazada"
      >
        <CohortHeatmap cohorts={report.cohorts} />
      </ReportPanel>

      <CohortTable report={report} periodName={periodName} />
    </div>
  )
}

type Column = "cohort" | "total" | "open" | "won" | "lost" | "closeRate" | "ticket" | "revenue" | "days"

function CohortTable({ report, periodName }: { report: CohortReport; periodName: string }) {
  const { sort, sorted, toggle } = useTableSort<CohortGroup, Column>(
    report.cohorts,
    {
      cohort: (row) => row.cohortKey,
      total: (row) => row.totalDeals,
      open: (row) => row.openDeals,
      won: (row) => row.wonDeals,
      lost: (row) => row.lostDeals,
      closeRate: (row) => row.closeRate,
      ticket: (row) => row.averageTicket,
      revenue: (row) => row.totalRevenue,
      days: (row) => row.averageDaysToClose,
    },
    { key: "cohort", direction: "desc" }
  )

  return (
    <ReportTablePanel
      id="cohorts-table-heading"
      title="Todas as safras"
      subtitle={periodName}
      aside={
        <ExportCsvButton
          report="safras"
          period={report.period}
          rows={sorted}
          columns={[
            { header: "Safra", value: (row) => formatCohortLabel(row.cohortKey) },
            { header: "Negócios", value: (row) => row.totalDeals },
            { header: "Em aberto", value: (row) => row.openDeals },
            { header: "Ganhos", value: (row) => row.wonDeals },
            { header: "Perdidos", value: (row) => row.lostDeals },
            { header: "Taxa de fechamento", value: (row) => row.closeRate },
            { header: "Ticket médio", value: (row) => row.averageTicket },
            { header: "Receita", value: (row) => row.totalRevenue },
            { header: "Dias até fechar", value: (row) => row.averageDaysToClose },
          ]}
        />
      }
    >
      <Table minWidth="900px">
        <TableHeader>
          <tr>
            <SortableHead columnKey="cohort" sort={sort} onSort={toggle} defaultDirection="desc">
              Safra
            </SortableHead>
            <SortableHead columnKey="total" sort={sort} onSort={toggle} numeric>
              Negócios
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
            <SortableHead columnKey="days" sort={sort} onSort={toggle} numeric defaultDirection="asc">
              Até fechar
            </SortableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {sorted.map((cohort) => (
            <TableRow key={cohort.cohortKey}>
              <TableRowHeader className="tabular">{formatCohortLabel(cohort.cohortKey)}</TableRowHeader>
              <TableCell numeric className="text-fg">
                {numberFormatter.format(cohort.totalDeals)}
              </TableCell>
              <TableCell numeric>{numberFormatter.format(cohort.openDeals)}</TableCell>
              <TableCell numeric>{numberFormatter.format(cohort.wonDeals)}</TableCell>
              <TableCell numeric>{numberFormatter.format(cohort.lostDeals)}</TableCell>
              <TableCell numeric className={cn("font-medium", closeRateTone(cohort.closeRate))}>
                {formatPercent(cohort.closeRate)}
              </TableCell>
              <TableCell numeric>{formatMoney(cohort.averageTicket)}</TableCell>
              <TableCell numeric className="font-medium text-fg">
                {formatMoney(cohort.totalRevenue)}
              </TableCell>
              <TableCell numeric>{formatDays(cohort.averageDaysToClose)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ReportTablePanel>
  )
}
