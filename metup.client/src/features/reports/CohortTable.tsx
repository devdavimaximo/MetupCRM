import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/states"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableRowHeader } from "@/components/ui/table"
import { numberFormatter } from "@/lib/format"
import { formatMoney } from "@/lib/money"
import type { CohortGroup } from "./api"
import { closeRateTone, formatDays, formatPercent } from "./report-ui"

const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" })

function formatCohortLabel(cohortKey: string): string {
  const label = monthLabelFormatter.format(new Date(`${cohortKey}-01T00:00:00`)).replace(".", "")
  return label.charAt(0).toUpperCase() + label.slice(1)
}

type Props = {
  cohorts: CohortGroup[]
  emptyMessage: string
}

/**
 * Tabela de safras (V3, sétima fatia — seção 7 do CLAUDE.md): uma linha por mês de entrada no
 * funil, mais recente primeiro. Diferente de SalesPerformanceTable (usada pelas quebras por
 * responsável/segmento/origem), traz o total de negócios da safra e o tempo médio até fechar —
 * o que faz sentido só num corte temporal e comparativo.
 */
export function CohortTable({ cohorts, emptyMessage }: Props) {
  if (cohorts.length === 0) {
    return (
      <Card>
        <EmptyState compact title="Nenhuma safra" description={emptyMessage} />
      </Card>
    )
  }

  const sorted = [...cohorts].sort((a, b) => b.cohortKey.localeCompare(a.cohortKey))

  return (
    <Card>
      <Table minWidth="860px">
        <TableHeader>
          <tr>
            <TableHead>Safra</TableHead>
            <TableHead numeric>Negócios</TableHead>
            <TableHead numeric>Abertos</TableHead>
            <TableHead numeric>Ganhos</TableHead>
            <TableHead numeric>Perdidos</TableHead>
            <TableHead numeric>Fechamento</TableHead>
            <TableHead numeric>Ticket médio</TableHead>
            <TableHead numeric>Receita</TableHead>
            <TableHead numeric>Até fechar</TableHead>
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
              <TableCell numeric className={`font-medium ${closeRateTone(cohort.closeRate)}`}>
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
    </Card>
  )
}
