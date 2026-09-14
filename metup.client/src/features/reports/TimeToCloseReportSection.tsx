import { useEffect, useState } from "react"
import { CheckCircle2, Timer } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { toMessage } from "@/features/companies/form-errors"
import { getTimeToCloseReport, type TimeToCloseReport } from "./api"
import { ReportError, ReportLoading } from "./ReportStatus"

const numberFormatter = new Intl.NumberFormat("pt-BR")

function formatDays(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return `${numberFormatter.format(rounded)} ${rounded === 1 ? "dia" : "dias"}`
}

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
    <section aria-labelledby="time-to-close-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="time-to-close-heading" className="text-sm font-semibold text-foreground">
          Tempo até fechamento
        </h2>
        <p className="text-sm text-muted-foreground">
          Quanto tempo, em média, um negócio leva da criação até ser ganho.
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Timer className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Tempo médio até fechar</p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {report.averageDaysToClose === null ? "—" : formatDays(report.averageDaysToClose)}
              </p>
              <p className="text-sm text-muted-foreground">
                {report.averageDaysToClose === null
                  ? "Sem negócios ganhos no período para calcular."
                  : "da criação do negócio até o fechamento como ganho"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            {numberFormatter.format(report.wonDealsCount)} {report.wonDealsCount === 1 ? "negócio ganho" : "negócios ganhos"}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
