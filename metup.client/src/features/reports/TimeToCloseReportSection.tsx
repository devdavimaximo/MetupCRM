import { useEffect, useState } from "react"

import { Card } from "@/components/ui/card"
import { toMessage } from "@/features/companies/form-errors"
import { numberFormatter } from "@/lib/format"
import { cn } from "@/lib/utils"
import { getTimeToCloseReport, type TimeToCloseReport } from "./api"
import { ReportError, ReportLoading } from "./ReportStatus"
import { Metric, ReportHeading, formatDays } from "./report-ui"

type Props = {
  fromIso?: string
  toIso?: string
}

/** Tempo ponta a ponta do funil (V3, quarta fatia — seção 7 do CLAUDE.md): CreatedAt → ClosedAt dos negócios ganhos. */
export function TimeToCloseReportSection({ fromIso, toIso }: Props) {
  const [report, setReport] = useState<TimeToCloseReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    getTimeToCloseReport({ from: fromIso, to: toIso }, controller.signal)
      .then(setReport)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(toMessage(err, "Não foi possível carregar o relatório de tempo até fechamento."))
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
    <section aria-labelledby="time-to-close-heading" className={cn("flex flex-col gap-5", isLoading && "opacity-60")}>
      <ReportHeading
        id="time-to-close-heading"
        title="Tempo até fechamento"
        description="Quanto tempo, em média, um negócio leva da criação até ser ganho."
      />

      <Card className="grid sm:grid-cols-2">
        <Metric
          className="border-b border-line-soft sm:border-r sm:border-b-0"
          label="Tempo médio até fechar"
          value={formatDays(report.averageDaysToClose)}
          caption={
            report.averageDaysToClose === null
              ? "Sem negócios ganhos no período para calcular."
              : "da criação do negócio até o fechamento como ganho"
          }
        />
        <Metric
          label="Base do cálculo"
          value={numberFormatter.format(report.wonDealsCount)}
          caption={report.wonDealsCount === 1 ? "negócio ganho no período" : "negócios ganhos no período"}
        />
      </Card>
    </section>
  )
}
