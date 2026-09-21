import { Panel, PanelHeading } from "@/components/metrics/panel"
import { Skeleton } from "@/components/ui/states"
import { Hint } from "@/components/ui/tooltip"
import { numberFormatter } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { DealStage, PipelineSummary } from "./api"
import { formatMoneyCompact, formatMoneyWhole, formatPercent } from "./pipeline-metrics"
import { stageIcons } from "./stage-icons"
import { stageLabels } from "./stage-labels"

/** Largura da faixa da etapa: afina do topo (100%) até a base (52%), como na referência. */
const widthOf = (index: number, total: number) => 100 - (index / Math.max(1, total - 1)) * 48

/**
 * O funil de vendas em coorte do período (item 10): uma faixa por etapa, afinando, com quantidade,
 * valor e % do topo. Os números estão em texto numa lista ordenada — o desenho é a faixa, não a
 * informação. Clicar numa etapa leva o quadro até a coluna e a destaca.
 */
export function PipelineFunnel({
  summary,
  isLoading,
  periodLabel,
  onOpenStage,
}: {
  summary: PipelineSummary | null
  isLoading: boolean
  /** "Últimos 30 dias", "Este mês"… — a janela da coorte, dita por extenso. */
  periodLabel: string
  onOpenStage: (stage: DealStage) => void
}) {
  if (!summary) {
    return (
      <Panel aria-busy={isLoading} className="min-h-fit gap-3 px-4 py-3.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-40 w-full" />
      </Panel>
    )
  }

  const { funnel, funnelSummary } = summary
  const total = funnel.length

  return (
    <Panel aria-labelledby="funnel-heading" className="min-h-fit gap-3 px-4 py-3.5" data-testid="pipeline-funnel">
      <PanelHeading
        id="funnel-heading"
        title="Funil de Vendas"
        subtitle={`Coorte de ${periodLabel.toLowerCase()}: os negócios criados no período e até onde cada um chegou.`}
      />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        {/* Abaixo de xl o funil rola na horizontal — nunca a página. */}
        <ol className="flex min-w-0 flex-1 flex-col gap-1.5 max-xl:overflow-x-auto">
          {funnel.map((step, index) => {
            const Icon = stageIcons[step.stage]
            const isClosed = step.stage === "Ganho"
            const label = stageLabels[step.stage]
            const share = step.pctOfTop === null ? "—" : formatPercent(step.pctOfTop)

            const row = (
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <Icon className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm text-fg">{label}</span>
                <span className="shrink-0 text-sm font-medium text-fg tabular">{numberFormatter.format(step.reached)}</span>
                <span
                  className="w-24 shrink-0 text-right text-xs text-fg-muted tabular max-sm:hidden"
                  title={step.value > 0 ? formatMoneyWhole(step.value) : undefined}
                >
                  {step.value > 0 ? formatMoneyCompact(step.value) : "R$ —"}
                </span>
                <span className="w-12 shrink-0 text-right text-xs text-muted tabular">{share}</span>
              </span>
            )

            return (
              <li key={step.stage} className="relative min-w-0 max-xl:min-w-104">
                {/* A faixa é só o desenho, atrás da linha; os números estão em texto, na frente. */}
                <span
                  aria-hidden="true"
                  style={{ width: `${widthOf(index, total)}%` }}
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-xs border",
                    isClosed ? "border-success/40 bg-success/12" : "border-accent/30 bg-accent/10"
                  )}
                />
                {isClosed ? (
                  <span className="relative flex min-h-9 min-w-0 items-center px-2.5">{row}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenStage(step.stage)}
                    aria-label={`${label}: ${numberFormatter.format(step.reached)} negócios, ${share} do topo. Ir para a coluna no quadro`}
                    className="relative flex min-h-9 w-full min-w-0 cursor-pointer items-center rounded-xs px-2.5 text-left transition-colors hover:bg-surface-3/40 focus-visible:focus-ring"
                  >
                    {row}
                  </button>
                )}
              </li>
            )
          })}
        </ol>

        <div className="shrink-0 border-line-soft xl:w-60 xl:border-l xl:pl-5">
          <p className="text-md leading-snug text-fg">
            Do total de <span className="font-semibold tabular">{numberFormatter.format(funnelSummary.top)}</span> prospects,{" "}
            <span className="font-semibold tabular">{funnelSummary.pct === null ? "—" : formatPercent(funnelSummary.pct)}</span> se tornaram
            clientes.
          </p>
          <Hint content="A coorte são os negócios criados dentro do período. Uma etapa pulada conta como alcançada, e Ganho alcança todas — por isso o funil só afina quando alguém realmente parou no caminho.">
            <p tabIndex={0} className="mt-1.5 w-fit rounded-xs text-xs text-fg-muted focus-visible:focus-ring">
              {numberFormatter.format(funnelSummary.won)} ganhos entre os criados em {periodLabel.toLowerCase()}.
            </p>
          </Hint>
        </div>
      </div>
    </Panel>
  )
}
