import { AlertTriangle, ArrowRight, Layers, TrendingUp, type LucideIcon } from "lucide-react"

import { Panel, PanelHeading } from "@/components/metrics/panel"
import { Alert, Skeleton } from "@/components/ui/states"
import type { DealStage, PipelineInsights } from "./api"
import { passageSentence, riskSentence, volumeSentence } from "./pipeline-metrics"

/** O mesmo mínimo do servidor (`PipelineInsightsDto.MinimumPassageSample`), só para a frase. */
const MINIMUM_PASSAGE_SAMPLE = 5

/**
 * Os três diagnósticos dos últimos 30 dias (item 17). Cada card tem uma frase e, quando há o que
 * abrir, uma ação: volume e passagem levam à etapa (lista lateral); o risco abre a lista de parados.
 */
export function PipelineInsightsCards({
  insights,
  isLoading,
  error,
  onRetry,
  onOpenStage,
  onOpenStalled,
}: {
  insights: PipelineInsights | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
  onOpenStage: (stage: DealStage) => void
  onOpenStalled: () => void
}) {
  return (
    <Panel aria-labelledby="insights-heading" className="min-h-fit gap-3 px-4 py-3.5">
      <PanelHeading id="insights-heading" title="Insights do Pipeline" subtitle="Últimos 30 dias" />

      {error && !insights ? (
        <Alert onRetry={onRetry}>{error}</Alert>
      ) : !insights ? (
        <div role="status" aria-busy={isLoading} className="flex flex-col gap-3">
          <span className="sr-only">Carregando insights…</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          <InsightRow
            icon={Layers}
            title="Maior volume"
            sentence={volumeSentence(insights.volume)}
            action={insights.volume && { label: "Ver detalhes", onAction: () => onOpenStage(insights.volume!.stage) }}
          />
          <InsightRow
            icon={TrendingUp}
            title="Melhor passagem"
            sentence={passageSentence(insights.bestPassage, MINIMUM_PASSAGE_SAMPLE)}
            action={
              insights.bestPassage && {
                label: "Ver detalhes",
                onAction: () => onOpenStage(insights.bestPassage!.fromStage),
              }
            }
          />
          <InsightRow
            icon={AlertTriangle}
            tone="danger"
            title="Oportunidades em risco"
            sentence={riskSentence(insights.risk)}
            action={insights.risk.count > 0 ? { label: "Ver lista", onAction: onOpenStalled } : null}
          />
        </ul>
      )}
    </Panel>
  )
}

function InsightRow({
  icon: Icon,
  title,
  sentence,
  action,
  tone = "default",
}: {
  icon: LucideIcon
  title: string
  sentence: string
  action?: { label: string; onAction: () => void } | null
  tone?: "default" | "danger"
}) {
  return (
    <li className="flex min-w-0 gap-3 rounded-sm border border-line-soft bg-surface-2/40 px-3 py-2.5">
      <span
        className={
          tone === "danger"
            ? "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-3/80 text-danger"
            : "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-3/80 text-accent"
        }
      >
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted">{title}</span>
        <span className="block text-sm text-fg">{sentence}</span>
        {action && (
          <button
            type="button"
            onClick={action.onAction}
            className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded-xs text-xs text-accent max-md:min-h-11 transition-colors hover:text-accent-hover focus-visible:focus-ring"
          >
            {action.label}
            <ArrowRight className="size-3" aria-hidden="true" />
          </button>
        )}
      </span>
    </li>
  )
}
