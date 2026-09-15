import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/states"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableRowHeader } from "@/components/ui/table"
import { stageLabels } from "@/features/deals/stage-labels"
import { numberFormatter } from "@/lib/format"
import { formatMoney } from "@/lib/money"
import type { ForecastByStage } from "./api"
import { formatPercent } from "./report-ui"

type Props = {
  byStage: ForecastByStage[]
  emptyMessage: string
}

/**
 * Tabela de pipeline aberto por estágio (V3, sexta fatia — seção 7 do CLAUDE.md): valor bruto em
 * aberto x valor ponderado pela probabilidade histórica de fechar como ganho. Estágios sem
 * histórico de negócios fechados mostram "—" na probabilidade e no ponderado — sem número inventado.
 */
export function ForecastTable({ byStage, emptyMessage }: Props) {
  if (byStage.length === 0) {
    return (
      <Card>
        <EmptyState compact title="Nada para projetar" description={emptyMessage} />
      </Card>
    )
  }

  return (
    <Card>
      <Table minWidth="640px">
        <TableHeader>
          <tr>
            <TableHead>Estágio</TableHead>
            <TableHead numeric>Negócios</TableHead>
            <TableHead numeric>Valor em aberto</TableHead>
            <TableHead numeric>Prob. histórica</TableHead>
            <TableHead numeric>Valor ponderado</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {byStage.map((row) => (
            <TableRow key={row.stage}>
              <TableRowHeader>{stageLabels[row.stage]}</TableRowHeader>
              <TableCell numeric>{numberFormatter.format(row.openDealsCount)}</TableCell>
              <TableCell numeric>{formatMoney(row.openAmount)}</TableCell>
              <TableCell numeric>
                {row.winProbability === null ? (
                  <span className="text-faint">—</span>
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
      </Table>
    </Card>
  )
}
