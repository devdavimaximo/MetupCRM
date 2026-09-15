import { useEffect, useState } from "react"
import { ArrowRight } from "lucide-react"

import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/states"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toMessage } from "@/features/companies/form-errors"
import { ACTIVE_STAGES, stageLabels } from "@/features/deals/stage-labels"
import { numberFormatter } from "@/lib/format"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import { getFunnelReport, type FunnelReport } from "./api"
import { ReportError, ReportLoading } from "./ReportStatus"
import { Metric, formatDays } from "./report-ui"

type Props = {
  fromIso?: string
  toIso?: string
}

/** Funil histórico completo e tempo por estágio (V3, primeira fatia — seção 7 do CLAUDE.md). */
export function FunnelReportSection({ fromIso, toIso }: Props) {
  const [report, setReport] = useState<FunnelReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    getFunnelReport({ from: fromIso, to: toIso }, controller.signal)
      .then(setReport)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(toMessage(err, "Não foi possível carregar o relatório de funil."))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [fromIso, toIso, reloadVersion])

  const stageCounts = new Map(report?.dealsByStage.map((d) => [d.stage, d.count]) ?? [])
  const maxCount = Math.max(1, ...ACTIVE_STAGES.map((stage) => stageCounts.get(stage) ?? 0))
  const durationByStage = new Map(report?.averageDaysInStage.map((d) => [d.stage, d.averageDays]) ?? [])
  const wonCount = stageCounts.get("Ganho") ?? 0
  const lostCount = stageCounts.get("Perdido") ?? 0

  if (error) return <ReportError message={error} onRetry={() => setReloadVersion((v) => v + 1)} />
  if (isLoading && !report) return <ReportLoading />
  if (!report) return null

  const golden = report.goldenMetric.callsPerFiveThousand

  return (
    <div className={cn("flex flex-col gap-6", isLoading && "opacity-60")}>
      {/* A métrica de ouro (CLAUDE.md §2): o único número dourado da tela, de propósito. */}
      <Card className="relative overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_auto]">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 size-96 bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-accent)_14%,transparent),transparent)]"
        />
        <div className="relative flex flex-col gap-3 px-6 py-7 sm:px-8">
          <p className="label-mono flex items-center gap-2.5 text-accent">
            <span aria-hidden="true" className="h-px w-5 bg-accent" />A métrica de ouro
          </p>
          <p className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-display text-4xl font-semibold tracking-[-0.03em] text-accent tabular">
              {golden === null ? "—" : numberFormatter.format(Math.round(golden * 10) / 10)}
            </span>
            {golden !== null && <span className="font-display text-xl text-fg">ligações</span>}
          </p>
          <p className="text-base text-fg-muted">
            {golden === null ? "Sem receita fechada no período para calcular." : "em média, para gerar R$ 5.000 em vendas."}
          </p>
        </div>
        <div className="relative grid border-t border-line-soft sm:grid-cols-2 lg:grid-cols-1 lg:border-t-0 lg:border-l">
          <Metric
            className="border-b border-line-soft sm:border-r sm:border-b-0 lg:border-r-0 lg:border-b"
            label="Ligações"
            value={numberFormatter.format(report.goldenMetric.callsCount)}
          />
          <Metric label="Receita fechada" value={formatMoney(report.goldenMetric.closedRevenue)} />
        </div>
      </Card>

      <Card role="region" aria-labelledby="funnel-heading">
        <CardHeader>
          <CardTitle id="funnel-heading">Funil por estágio</CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-fg-muted">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
              <span className="text-fg tabular">{numberFormatter.format(wonCount)}</span> ganhos
            </span>
            <span className="flex items-center gap-1.5 text-fg-muted">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-danger" />
              <span className="text-fg tabular">{numberFormatter.format(lostCount)}</span> perdidos
            </span>
          </div>
        </CardHeader>

        <ol className="flex flex-col py-2">
          {ACTIVE_STAGES.map((stage, index) => {
            const count = stageCounts.get(stage) ?? 0
            const widthPercent = count === 0 ? 0 : Math.max(1.5, (count / maxCount) * 100)
            const avgDays = durationByStage.get(stage)

            return (
              <li
                key={stage}
                className="grid grid-cols-[1.5rem_minmax(0,9rem)_minmax(0,1fr)_3.5rem] items-center gap-x-3 px-4 py-2.5 sm:grid-cols-[1.5rem_11rem_minmax(0,1fr)_4rem_6.5rem] sm:px-5"
              >
                <span className="font-mono text-2xs text-faint tabular">{String(index + 1).padStart(2, "0")}</span>
                <span className={cn("truncate text-base", count === 0 ? "text-faint" : "text-fg")}>{stageLabels[stage]}</span>
                <span className="h-2 bg-surface-3" aria-hidden="true">
                  <span
                    className="block h-full bg-accent transition-[width] duration-500 ease-out"
                    style={{ width: `${widthPercent}%`, opacity: 1 - index * 0.09 }}
                  />
                </span>
                <span className={cn("text-right text-base font-medium tabular", count === 0 ? "text-faint" : "text-fg")}>
                  {numberFormatter.format(count)}
                  <span className="sr-only"> {count === 1 ? "negócio" : "negócios"}</span>
                </span>
                <span className="hidden text-right text-sm text-muted tabular sm:block">
                  {avgDays !== undefined ? (
                    <>
                      {formatDays(avgDays)}
                      <span className="sr-only"> em média no estágio</span>
                    </>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
        <p className="border-t border-line-soft px-5 py-2.5 text-xs text-faint">
          Barras: negócios por estágio. Coluna à direita: tempo médio que um negócio passa no estágio.
        </p>
      </Card>

      <Card role="region" aria-labelledby="conversion-heading">
        <CardHeader>
          <CardTitle id="conversion-heading">Conversão entre estágios</CardTitle>
        </CardHeader>

        {report.stageConversions.length === 0 ? (
          <EmptyState compact title="Nenhuma mudança de estágio" description="Nenhuma transição registrada no período selecionado." />
        ) : (
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Transição</TableHead>
                <TableHead numeric>Negócios</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {report.stageConversions.map((c) => (
                <TableRow key={`${c.fromStage}-${c.toStage}`}>
                  <TableCell>
                    <span className="flex items-center gap-2 text-fg">
                      <span className="text-fg-muted">{stageLabels[c.fromStage]}</span>
                      <ArrowRight className="size-3.5 text-faint" aria-label="para" />
                      {stageLabels[c.toStage]}
                    </span>
                  </TableCell>
                  <TableCell numeric className="font-medium text-fg">
                    {numberFormatter.format(c.count)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
