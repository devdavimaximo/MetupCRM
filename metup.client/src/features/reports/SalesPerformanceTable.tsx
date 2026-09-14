import { Card, CardContent } from "@/components/ui/card"
import { formatMoney } from "@/lib/money"
import type { SalesPerformanceGroup } from "./api"

const numberFormatter = new Intl.NumberFormat("pt-BR")
const percentFormatter = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 })

function formatPercent(value: number | null): string {
  return value === null ? "—" : percentFormatter.format(value)
}

function closeRateTone(value: number | null): string {
  if (value === null) return "text-muted-foreground"
  if (value >= 0.5) return "text-emerald-700 dark:text-emerald-400"
  if (value >= 0.25) return "text-amber-700 dark:text-amber-400"
  return "text-destructive"
}

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
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                <th scope="col" className="px-4 py-3 font-medium">
                  {groupLabelHeader}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Abertos
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Ganhos
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Perdidos
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Taxa de fechamento
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Ticket médio
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Receita fechada
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groups.map((group) => (
                <tr key={group.groupKey}>
                  <th scope="row" className="px-4 py-3 text-left font-medium text-foreground">
                    {group.groupLabel}
                  </th>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {numberFormatter.format(group.openDeals)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {numberFormatter.format(group.wonDeals)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {numberFormatter.format(group.lostDeals)}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold tabular-nums ${closeRateTone(group.closeRate)}`}>
                    {formatPercent(group.closeRate)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">{formatMoney(group.averageTicket)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                    {formatMoney(group.totalRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
