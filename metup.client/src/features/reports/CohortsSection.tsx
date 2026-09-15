import { useEffect, useState } from "react"

import { toMessage } from "@/features/companies/form-errors"
import { cn } from "@/lib/utils"
import { getCohortReport, type CohortReport } from "./api"
import { CohortTable } from "./CohortTable"
import { ReportError, ReportLoading } from "./ReportStatus"
import { ReportHeading } from "./report-ui"

type Props = {
  fromIso?: string
  toIso?: string
}

/**
 * Safras (cohorts) de negócios pelo mês de entrada no funil (V3, sétima fatia — seção 7 do
 * CLAUDE.md): diferente das quebras por responsável/segmento/origem, que cortam um período fixo,
 * aqui o corte é temporal — cada linha é uma safra, e a tabela compara como cada uma converteu e
 * quão rápido, ao longo do tempo.
 */
export function CohortsSection({ fromIso, toIso }: Props) {
  const [report, setReport] = useState<CohortReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    getCohortReport({ from: fromIso, to: toIso }, controller.signal)
      .then(setReport)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(toMessage(err, "Não foi possível carregar o relatório de safras."))
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
    <section aria-labelledby="cohorts-heading" className={cn("flex flex-col gap-5", isLoading && "opacity-60")}>
      <ReportHeading
        id="cohorts-heading"
        title="Safras"
        description="Negócios agrupados pelo mês em que entraram no funil, comparando conversão e tempo até fechar entre safras."
      />
      <CohortTable cohorts={report.cohorts} emptyMessage="Nenhuma safra no período selecionado." />
    </section>
  )
}
