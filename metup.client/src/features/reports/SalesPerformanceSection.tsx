import { useEffect, useState, type ReactNode } from "react"

import { toMessage } from "@/features/companies/form-errors"
import { cn } from "@/lib/utils"
import type { SalesPerformanceGroup, SalesPerformanceReport } from "./api"
import { ReportError, ReportLoading } from "./ReportStatus"
import { SalesPerformanceTable } from "./SalesPerformanceTable"
import { ReportHeading } from "./report-ui"

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
  renderTable?: (groups: SalesPerformanceGroup[]) => ReactNode
  headingAside?: ReactNode
}

/**
 * Seção genérica de desempenho comercial (V3, seção 7 do CLAUDE.md) — busca o relatório e renderiza
 * a tabela; reaproveitada pelas quebras por responsável, segmento, origem e pelo ranking (mesmos
 * dados, só a tabela final muda via `renderTable`).
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
  renderTable,
  headingAside,
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
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-5", isLoading && "opacity-60")}>
      <ReportHeading id={headingId} title={heading} description={description} aside={headingAside} />

      {renderTable ? (
        renderTable(groups)
      ) : (
        <SalesPerformanceTable groupLabelHeader={groupLabelHeader} groups={groups} emptyMessage={emptyMessage} />
      )}
    </section>
  )
}
