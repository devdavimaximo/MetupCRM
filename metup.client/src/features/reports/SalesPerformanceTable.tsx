import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/states"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableRowHeader } from "@/components/ui/table"
import { numberFormatter } from "@/lib/format"
import { formatMoney } from "@/lib/money"
import type { SalesPerformanceGroup } from "./api"
import { closeRateTone, formatPercent } from "./report-ui"

type Props = {
  groupLabelHeader: string
  groups: SalesPerformanceGroup[]
  emptyMessage: string
}

/**
 * Tabela genérica de desempenho comercial (V3) — reaproveitada pelas quebras por responsável,
 * segmento e origem (seção 7 do CLAUDE.md); a única diferença entre elas é o rótulo da primeira
 * coluna.
 */
export function SalesPerformanceTable({ groupLabelHeader, groups, emptyMessage }: Props) {
  if (groups.length === 0) {
    return (
      <Card>
        <EmptyState compact title="Sem dados no período" description={emptyMessage} />
      </Card>
    )
  }

  return (
    <Card>
      <Table minWidth="720px">
        <TableHeader>
          <tr>
            <TableHead>{groupLabelHeader}</TableHead>
            <TableHead numeric>Abertos</TableHead>
            <TableHead numeric>Ganhos</TableHead>
            <TableHead numeric>Perdidos</TableHead>
            <TableHead numeric>Taxa de fechamento</TableHead>
            <TableHead numeric>Ticket médio</TableHead>
            <TableHead numeric>Receita fechada</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <TableRow key={group.groupKey}>
              <TableRowHeader>{group.groupLabel}</TableRowHeader>
              <TableCell numeric>{numberFormatter.format(group.openDeals)}</TableCell>
              <TableCell numeric>{numberFormatter.format(group.wonDeals)}</TableCell>
              <TableCell numeric>{numberFormatter.format(group.lostDeals)}</TableCell>
              <TableCell numeric className={`font-medium ${closeRateTone(group.closeRate)}`}>
                {formatPercent(group.closeRate)}
              </TableCell>
              <TableCell numeric>{formatMoney(group.averageTicket)}</TableCell>
              <TableCell numeric className="font-medium text-fg">
                {formatMoney(group.totalRevenue)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
