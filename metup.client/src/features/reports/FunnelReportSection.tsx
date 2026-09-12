import { useEffect, useState } from "react"
import { ArrowRight, Phone, TrendingUp } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { toMessage } from "@/features/companies/form-errors"
import { ACTIVE_STAGES, stageLabels } from "@/features/deals/stage-labels"
import { formatMoney } from "@/lib/money"
import { getFunnelReport, type FunnelReport } from "./api"
import { ReportError, ReportLoading } from "./ReportStatus"

const numberFormatter = new Intl.NumberFormat("pt-BR")

function formatDays(value: number): string {
  return `${numberFormatter.format(Math.round(value * 10) / 10)} ${value === 1 ? "dia" : "dias"}`
}

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

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <TrendingUp className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">A métrica de ouro</p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {report.goldenMetric.callsPerFiveThousand === null
                  ? "—"
                  : `${numberFormatter.format(Math.round(report.goldenMetric.callsPerFiveThousand * 10) / 10)} ligações`}
              </p>
              <p className="text-sm text-muted-foreground">
                {report.goldenMetric.callsPerFiveThousand === null
                  ? "Sem receita fechada no período para calcular."
                  : "em média, para gerar R$ 5.000 em vendas"}
              </p>
            </div>
          </div>

          <div className="flex gap-4 text-right">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Phone className="size-3.5" aria-hidden="true" />
              {numberFormatter.format(report.goldenMetric.callsCount)} ligações
            </div>
            <div className="text-sm text-muted-foreground">{formatMoney(report.goldenMetric.closedRevenue)} fechados</div>
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="funnel-heading" className="flex flex-col gap-3">
        <h2 id="funnel-heading" className="text-sm font-semibold text-foreground">
          Funil por estágio
        </h2>

        <Card>
          <CardContent className="flex flex-col gap-3 pt-2">
            {ACTIVE_STAGES.map((stage) => {
              const count = stageCounts.get(stage) ?? 0
              const widthPercent = Math.max(4, (count / maxCount) * 100)
              const avgDays = durationByStage.get(stage)

              return (
                <div key={stage} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-foreground">{stageLabels[stage]}</span>
                    <span className="text-muted-foreground">
                      <span className="font-semibold tabular-nums text-foreground">{numberFormatter.format(count)}</span>{" "}
                      {count === 1 ? "negócio" : "negócios"}
                      {avgDays !== undefined && <span className="ml-2">· {formatDays(avgDays)} em média</span>}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {(wonCount > 0 || lostCount > 0) && (
          <div className="flex gap-3 text-sm">
            <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700 dark:text-emerald-400">
              {numberFormatter.format(wonCount)} ganhos
            </span>
            <span className="rounded-md bg-destructive/10 px-2.5 py-1 font-medium text-destructive">
              {numberFormatter.format(lostCount)} perdidos
            </span>
          </div>
        )}
      </section>

      <section aria-labelledby="conversion-heading" className="flex flex-col gap-3">
        <h2 id="conversion-heading" className="text-sm font-semibold text-foreground">
          Conversão entre estágios
        </h2>

        {report.stageConversions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma mudança de estágio registrada no período.
          </p>
        ) : (
          <Card>
            <CardContent className="flex flex-col divide-y divide-border pt-2">
              {report.stageConversions.map((c) => (
                <div
                  key={`${c.fromStage}-${c.toStage}`}
                  className="flex items-center justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0"
                >
                  <span className="flex items-center gap-1.5 text-foreground">
                    {stageLabels[c.fromStage]}
                    <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    {stageLabels[c.toStage]}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {numberFormatter.format(c.count)} {c.count === 1 ? "negócio" : "negócios"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
