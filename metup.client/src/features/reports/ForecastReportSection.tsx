import { useEffect, useState } from "react"
import { TrendingUp, Wallet } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { toMessage } from "@/features/companies/form-errors"
import { formatMoney } from "@/lib/money"
import { getForecastReport, type ForecastReport } from "./api"
import { ForecastTable } from "./ForecastTable"
import { ReportError, ReportLoading } from "./ReportStatus"

const numberFormatter = new Intl.NumberFormat("pt-BR")

type Props = {
  fromIso?: string
  toIso?: string
}

/**
 * Forecast / receita potencial (V3, sexta fatia — seção 7 do CLAUDE.md): diferente dos demais
 * relatórios, que olham para negócios fechados (retrospectivo), este olha para o pipeline aberto
 * e projeta receita ponderando cada estágio pela probabilidade histórica de fechar como ganho
 * (prospectivo).
 */
export function ForecastReportSection({ fromIso, toIso }: Props) {
  const [report, setReport] = useState<ForecastReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    getForecastReport({ from: fromIso, to: toIso }, controller.signal)
      .then(setReport)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(toMessage(err, "Não foi possível carregar o forecast."))
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
    <section aria-labelledby="forecast-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="forecast-heading" className="text-sm font-semibold text-foreground">
          Forecast
        </h2>
        <p className="text-sm text-muted-foreground">
          Quanto de receita está em andamento no pipeline aberto e quão provável é ela fechar, dado o estágio atual.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-start gap-3 py-2">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Wallet className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Pipeline aberto</p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {formatMoney(report.totalPipelineAmount)}
              </p>
              <p className="text-sm text-muted-foreground">
                {numberFormatter.format(report.totalOpenDeals)}{" "}
                {report.totalOpenDeals === 1 ? "negócio em aberto" : "negócios em aberto"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3 py-2">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <TrendingUp className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Receita ponderada</p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {formatMoney(report.totalWeightedForecast)}
              </p>
              <p className="text-sm text-muted-foreground">
                ponderado pela probabilidade histórica de fechar como ganho, por estágio
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <ForecastTable byStage={report.byStage} emptyMessage="Nenhum negócio em aberto no período selecionado." />
    </section>
  )
}
