import { Card } from "@/components/ui/card"
import { Monogram } from "@/components/ui/monogram"
import { EmptyState } from "@/components/ui/states"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableRowHeader } from "@/components/ui/table"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { SalesPerformanceGroup } from "./api"
import { formatPercent } from "./report-ui"

export type RankingMetric = "totalRevenue" | "closeRate"

function metricValue(group: SalesPerformanceGroup, metric: RankingMetric): number {
  if (metric === "totalRevenue") return group.totalRevenue
  return group.closeRate ?? -1
}

type Props = {
  groups: SalesPerformanceGroup[]
  metric: RankingMetric
  emptyMessage: string
}

/**
 * Ranking de responsáveis (V3, última fatia — CLAUDE.md seção 12): os mesmos dados de
 * SalesPerformanceGroupDto (desempenho por responsável), ordenados pela métrica escolhida e com
 * posição explícita — não é "os números do responsável X", é "quem está na frente e por quê".
 * A barra mostra a distância para o primeiro colocado na métrica escolhida.
 */
export function RankingTable({ groups, metric, emptyMessage }: Props) {
  if (groups.length === 0) {
    return (
      <Card>
        <EmptyState compact title="Ranking vazio" description={emptyMessage} />
      </Card>
    )
  }

  const ranked = [...groups].sort((a, b) => metricValue(b, metric) - metricValue(a, metric))
  const leader = Math.max(0, metricValue(ranked[0], metric))

  return (
    <Card>
      <Table minWidth="600px">
        <TableHeader>
          <tr>
            <TableHead className="w-16">Pos.</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead className="hidden w-[30%] md:table-cell">
              <span className="sr-only">Comparação com o líder</span>
            </TableHead>
            <TableHead numeric>Receita fechada</TableHead>
            <TableHead numeric>Fechamento</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {ranked.map((group, index) => {
            const position = index + 1
            const share = leader > 0 ? Math.max(0, metricValue(group, metric)) / leader : 0
            return (
              <TableRow key={group.groupKey}>
                <TableCell>
                  <span className={cn("font-mono text-sm tabular", position === 1 ? "text-accent" : position <= 3 ? "text-fg" : "text-faint")}>
                    {String(position).padStart(2, "0")}
                  </span>
                </TableCell>
                <TableRowHeader>
                  <span className="flex items-center gap-3">
                    <Monogram name={group.groupLabel} size="xs" className={cn(position === 1 && "border-accent/40 text-accent")} />
                    {group.groupLabel}
                  </span>
                </TableRowHeader>
                <TableCell className="hidden md:table-cell">
                  <span className="block h-1 w-full bg-surface-3" aria-hidden="true">
                    <span
                      className={cn("block h-full", position === 1 ? "bg-accent" : "bg-fg-muted/60")}
                      style={{ width: `${share * 100}%` }}
                    />
                  </span>
                </TableCell>
                <TableCell numeric className={cn(metric === "totalRevenue" ? "font-medium text-fg" : "")}>
                  {formatMoney(group.totalRevenue)}
                </TableCell>
                <TableCell numeric className={cn(metric === "closeRate" ? "font-medium text-fg" : "")}>
                  {formatPercent(group.closeRate)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}
