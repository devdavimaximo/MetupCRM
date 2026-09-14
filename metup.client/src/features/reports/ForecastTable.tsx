import { Card, CardContent } from "@/components/ui/card"
import { stageLabels } from "@/features/deals/stage-labels"
import { formatMoney } from "@/lib/money"
import type { ForecastByStage } from "./api"

const numberFormatter = new Intl.NumberFormat("pt-BR")
const percentFormatter = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 })

function formatPercent(value: number | null): string {
  return value === null ? "—" : percentFormatter.format(value)
}

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
                  Estágio
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Negócios
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Valor em aberto
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Probabilidade histórica
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Valor ponderado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {byStage.map((row) => (
                <tr key={row.stage}>
                  <th scope="row" className="px-4 py-3 text-left font-medium text-foreground">
                    {stageLabels[row.stage]}
                  </th>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {numberFormatter.format(row.openDealsCount)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">{formatMoney(row.openAmount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {formatPercent(row.winProbability)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                    {row.weightedAmount === null ? "—" : formatMoney(row.weightedAmount)}
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
