import { useEffect, useState } from "react"

import { toMessage } from "@/features/companies/form-errors"
import type { SalesPerformanceGroup, SalesPerformanceReport } from "./api"
import { ReportError, ReportLoading } from "./ReportStatus"
import { SalesPerformanceTable } from "./SalesPerformanceTable"

type Props = {
  headingId: string
  heading: string
  description: string
  groupLabelHeader: string
  emptyMessage: string
  loadErrorMessage: string
  fromIso?: string
  toIso?: string
  fetchReport: (params: { from?: string; to?: string }, signal: AbortSignal) => Promise<SalesPerformanceReport>
  mapGroup?: (group: SalesPerformanceGroup) => SalesPerformanceGroup
}

/**
 * Seção genérica de desempenho comercial (V3, seção 7 do CLAUDE.md) — busca o relatório e renderiza
 * a tabela; reaproveitada pelas quebras por responsável, segmento e origem, que só variam nos
 * textos e na função de busca.
 */
export function SalesPerformanceSection({
  headingId,
  heading,
  description,
  groupLabelHeader,
  emptyMessage,
  loadErrorMessage,
  fromIso,
  toIso,
  fetchReport,
  mapGroup,
}: Props) {
  const [report, setReport] = useState<SalesPerformanceReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    fetchReport({ from: fromIso, to: toIso }, controller.signal)
      .then(setReport)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(toMessage(err, loadErrorMessage))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromIso, toIso, reloadVersion])

  if (error) return <ReportError message={error} onRetry={() => setReloadVersion((v) => v + 1)} />
  if (isLoading && !report) return <ReportLoading />
  if (!report) return null

  const groups = mapGroup ? report.groups.map(mapGroup) : report.groups

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div>
        <h2 id={headingId} className="text-sm font-semibold text-foreground">
          {heading}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <SalesPerformanceTable groupLabelHeader={groupLabelHeader} groups={groups} emptyMessage={emptyMessage} />
    </section>
  )
}
