import { Card, CardContent } from "@/components/ui/card"
import { formatMoney } from "@/lib/money"
import type { CohortGroup } from "./api"

const numberFormatter = new Intl.NumberFormat("pt-BR")
const percentFormatter = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 })
const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" })

function formatPercent(value: number | null): string {
  return value === null ? "—" : percentFormatter.format(value)
}

function formatDays(value: number | null): string {
  if (value === null) return "—"
  const rounded = Math.round(value * 10) / 10
  return `${numberFormatter.format(rounded)} ${rounded === 1 ? "dia" : "dias"}`
}

function formatCohortLabel(cohortKey: string): string {
  const label = monthLabelFormatter.format(new Date(`${cohortKey}-01T00:00:00`))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function closeRateTone(value: number | null): string {
  if (value === null) return "text-muted-foreground"
  if (value >= 0.5) return "text-emerald-700 dark:text-emerald-400"
  if (value >= 0.25) return "text-amber-700 dark:text-amber-400"
  return "text-destructive"
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
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }

  const sorted = [...cohorts].sort((a, b) => b.cohortKey.localeCompare(a.cohortKey))

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                <th scope="col" className="px-4 py-3 font-medium">
                  Safra
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Negócios
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
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Tempo até fechar
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((cohort) => (
                <tr key={cohort.cohortKey}>
                  <th scope="row" className="px-4 py-3 text-left font-medium text-foreground">
                    {formatCohortLabel(cohort.cohortKey)}
                  </th>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {numberFormatter.format(cohort.totalDeals)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {numberFormatter.format(cohort.openDeals)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {numberFormatter.format(cohort.wonDeals)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {numberFormatter.format(cohort.lostDeals)}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold tabular-nums ${closeRateTone(cohort.closeRate)}`}>
                    {formatPercent(cohort.closeRate)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">{formatMoney(cohort.averageTicket)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                    {formatMoney(cohort.totalRevenue)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {formatDays(cohort.averageDaysToClose)}
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
