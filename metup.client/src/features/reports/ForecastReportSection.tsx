import { useEffect, useState } from "react"

import { Card } from "@/components/ui/card"
import { toMessage } from "@/features/companies/form-errors"
import { pluralize } from "@/lib/format"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import { getForecastReport, type ForecastReport } from "./api"
import { ForecastTable } from "./ForecastTable"
import { ReportError, ReportLoading } from "./ReportStatus"
import { Metric, ReportHeading } from "./report-ui"

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

  const weightedShare = report.totalPipelineAmount > 0 ? report.totalWeightedForecast / report.totalPipelineAmount : null

  return (
    <section aria-labelledby="forecast-heading" className={cn("flex flex-col gap-5", isLoading && "opacity-60")}>
      <ReportHeading
        id="forecast-heading"
        title="Forecast"
        description="Quanto de receita está em andamento no pipeline aberto e quão provável é ela fechar, dado o estágio atual."
      />

      <Card className="grid sm:grid-cols-2">
        <Metric
          className="border-b border-line-soft sm:border-r sm:border-b-0"
          label="Pipeline aberto"
          value={formatMoney(report.totalPipelineAmount)}
          caption={pluralize(report.totalOpenDeals, "negócio em aberto", "negócios em aberto")}
        />
        <Metric
          tone="accent"
          label="Receita ponderada"
          value={formatMoney(report.totalWeightedForecast)}
          caption={
            weightedShare === null
              ? "ponderada pela probabilidade histórica de ganho por estágio"
              : `${Math.round(weightedShare * 100)}% do pipeline, pela probabilidade histórica de ganho por estágio`
          }
        />
      </Card>

      <ForecastTable byStage={report.byStage} emptyMessage="Nenhum negócio em aberto no período selecionado." />
    </section>
  )
}
