import { Card, CardContent } from "@/components/ui/card"
import { formatMoney } from "@/lib/money"
import type { SalesPerformanceGroup } from "./api"

export type RankingMetric = "totalRevenue" | "closeRate"

const percentFormatter = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 })

function formatPercent(value: number | null): string {
  return value === null ? "—" : percentFormatter.format(value)
}

function metricValue(group: SalesPerformanceGroup, metric: RankingMetric): number {
  if (metric === "totalRevenue") return group.totalRevenue
  return group.closeRate ?? -1
}

function positionLabel(position: number): string {
  if (position === 1) return "🥇 1º"
  if (position === 2) return "🥈 2º"
  if (position === 3) return "🥉 3º"
  return `${position}º`
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
 */
export function RankingTable({ groups, metric, emptyMessage }: Props) {
  if (groups.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }

  const ranked = [...groups].sort((a, b) => metricValue(b, metric) - metricValue(a, metric))

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                <th scope="col" className="px-4 py-3 font-medium">
                  Posição
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Responsável
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Receita fechada
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Taxa de fechamento
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ranked.map((group, index) => (
                <tr key={group.groupKey}>
                  <td className="px-4 py-3 text-left font-semibold tabular-nums text-foreground">
                    {positionLabel(index + 1)}
                  </td>
                  <th scope="row" className="px-4 py-3 text-left font-medium text-foreground">
                    {group.groupLabel}
                  </th>
                  <td
                    className={`px-4 py-3 text-right tabular-nums text-foreground ${
                      metric === "totalRevenue" ? "font-semibold" : ""
                    }`}
                  >
                    {formatMoney(group.totalRevenue)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums text-foreground ${
                      metric === "closeRate" ? "font-semibold" : ""
                    }`}
                  >
                    {formatPercent(group.closeRate)}
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
