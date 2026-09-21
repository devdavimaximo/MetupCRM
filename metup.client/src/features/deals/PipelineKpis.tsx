import { CircleDollarSign, Handshake, Percent, Receipt, TrendingUp, type LucideIcon } from "lucide-react"

import { KpiCard, KpiCarousel } from "@/components/metrics/KpiCard"
import type { Delta } from "@/components/metrics/delta"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/states"
import { cn } from "@/lib/utils"
import type { PipelineSummary } from "./api"
import {
  KPI_IDS,
  kpiDelta,
  kpiDisplay,
  kpiHints,
  kpiLabels,
  kpiValue,
  rateDelta,
  sparklineOf,
  type KpiId,
} from "./pipeline-metrics"

const icons: Record<KpiId, LucideIcon> = {
  pipelineTotal: CircleDollarSign,
  forecastRevenue: TrendingUp,
  openDeals: Handshake,
  conversionRate: Percent,
  averageTicket: Receipt,
}

function deltaOf(id: KpiId, summary: PipelineSummary): Delta {
  const current = kpiValue(id, summary.kpis)
  const previous = summary.previous ? kpiValue(id, summary.previous) : null
  return id === "conversionRate" ? rateDelta(current, previous) : kpiDelta(current, previous)
}

/** Subir é bom em todos os cinco — mais pipeline, mais previsão, mais negócios, mais conversão, ticket maior. */
const trendOf = (id: KpiId, summary: PipelineSummary): number[] => {
  const s = summary.sparklines
  switch (id) {
    case "pipelineTotal":
      return s.pipelineTotal
    case "forecastRevenue":
      return sparklineOf(s.forecastRevenue)
    case "openDeals":
      return s.openDeals
    case "conversionRate":
      return sparklineOf(s.conversionRate)
    case "averageTicket":
      return sparklineOf(s.averageTicket)
  }
}

/**
 * Os cinco KPIs do cabeçalho (item 9). Em 1366px cabem numa linha porque o valor vem compacto
 * ("R$ 2,86 mi"), com o número inteiro no `title`. O `×` oculta o cartão para este usuário neste
 * navegador (item 20) e o restante se redistribui — sem buraco no lugar.
 */
export function PipelineKpis({
  summary,
  isLoading,
  hidden,
  compact,
  onHide,
  onRestore,
  onOpenBoard,
  onOpenFunnel,
}: {
  summary: PipelineSummary | null
  isLoading: boolean
  hidden: readonly KpiId[]
  /** Celular: os cartões viram carrossel. */
  compact: boolean
  onHide: (id: KpiId) => void
  onRestore: () => void
  onOpenBoard: () => void
  onOpenFunnel: () => void
}) {
  const visible = KPI_IDS.filter((id) => !hidden.includes(id))

  if (visible.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-line-soft px-4 py-3">
        <p className="text-sm text-fg-muted">Todos os indicadores estão ocultos.</p>
        <Button variant="ghost" size="sm" onClick={onRestore}>
          Restaurar cards
        </Button>
      </div>
    )
  }

  if (!summary) {
    return (
      <div role="status" aria-busy={isLoading} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <span className="sr-only">Carregando indicadores do pipeline…</span>
        {visible.map((id) => (
          <Skeleton key={id} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  const cards = visible.map((id) => {
    const display = kpiDisplay(id, kpiValue(id, summary.kpis))
    const onClick = id === "openDeals" ? onOpenBoard : id === "conversionRate" ? onOpenFunnel : undefined

    return (
      <KpiCard
        key={id}
        icon={icons[id]}
        label={kpiLabels[id]}
        hint={kpiHints[id]}
        value={display.text}
        valueTitle={display.title}
        delta={deltaOf(id, summary)}
        comparison="período anterior"
        trend={trendOf(id, summary)}
        onClick={onClick}
        onDismiss={() => onHide(id)}
        dismissLabel={`Ocultar o indicador ${kpiLabels[id]}`}
      />
    )
  })

  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        <KpiCarousel label="Indicadores do pipeline">{cards}</KpiCarousel>
        <RestoreLine hidden={hidden.length} onRestore={onRestore} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-3", visible.length >= 5 ? "xl:grid-cols-5" : "xl:grid-cols-4")}>
        {cards}
      </div>
      <RestoreLine hidden={hidden.length} onRestore={onRestore} />
    </div>
  )
}

function RestoreLine({ hidden, onRestore }: { hidden: number; onRestore: () => void }) {
  if (hidden === 0) return null
  return (
    <div className="flex justify-end">
      <Button variant="ghost" size="sm" onClick={onRestore}>
        Restaurar cards ({hidden})
      </Button>
    </div>
  )
}
