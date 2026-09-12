import { useEffect, useState } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { toMessage } from "@/features/companies/form-errors"
import { formatMoney } from "@/lib/money"
import { getSalesPerformanceByOwner, type SalesPerformanceReport } from "./api"
import { ReportError, ReportLoading } from "./ReportStatus"

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
  fromIso?: string
  toIso?: string
}

/** Conversão e ticket médio por responsável (V3, segunda fatia — seção 7 do CLAUDE.md). */
export function SalesByOwnerSection({ fromIso, toIso }: Props) {
  const [report, setReport] = useState<SalesPerformanceReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    getSalesPerformanceByOwner({ from: fromIso, to: toIso }, controller.signal)
      .then(setReport)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(toMessage(err, "Não foi possível carregar o desempenho por responsável."))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [fromIso, toIso, reloadVersion])

  if (error) return <ReportError message={error} onRetry={() => setReloadVersion((v) => v + 1)} />
  if (isLoading && !report) return <ReportLoading />
  if (!report) return null

  return (
    <section aria-labelledby="sales-by-owner-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="sales-by-owner-heading" className="text-sm font-semibold text-foreground">
          Desempenho por responsável
        </h2>
        <p className="text-sm text-muted-foreground">
          Negócios abertos e fechados, taxa de fechamento e ticket médio de cada responsável no período.
        </p>
      </div>

      {report.byOwner.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhum negócio com responsável no período selecionado.
        </p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Responsável
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
                  {report.byOwner.map((owner) => (
                    <tr key={owner.ownerUserId}>
                      <th scope="row" className="px-4 py-3 text-left font-medium text-foreground">
                        {owner.ownerName}
                      </th>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {numberFormatter.format(owner.openDeals)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {numberFormatter.format(owner.wonDeals)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {numberFormatter.format(owner.lostDeals)}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${closeRateTone(owner.closeRate)}`}>
                        {formatPercent(owner.closeRate)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">{formatMoney(owner.averageTicket)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                        {formatMoney(owner.totalRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
