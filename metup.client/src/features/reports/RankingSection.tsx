import { useState } from "react"

import { getSalesPerformanceByOwner } from "./api"
import { RankingTable, type RankingMetric } from "./RankingTable"
import { SalesPerformanceSection } from "./SalesPerformanceSection"

type Props = {
  fromIso?: string
  toIso?: string
}

const METRICS: { id: RankingMetric; label: string }[] = [
  { id: "totalRevenue", label: "Receita fechada" },
  { id: "closeRate", label: "Taxa de fechamento" },
]

const EMPTY_MESSAGE = "Nenhum negócio com responsável no período selecionado."

/**
 * Ranking de responsáveis (V3, última fatia — CLAUDE.md seção 12): visão comparativa e ordenada
 * sobre os mesmos dados de desempenho por responsável (GetSalesPerformanceByOwnerQuery) — não
 * duplica a query, só ordena e numera a posição pela métrica escolhida.
 */
export function RankingSection({ fromIso, toIso }: Props) {
  const [metric, setMetric] = useState<RankingMetric>("totalRevenue")

  return (
    <div className="flex flex-col gap-3">
      <div
        role="radiogroup"
        aria-label="Ordenar ranking por"
        className="flex w-fit gap-1 rounded-lg border border-border bg-muted p-1"
      >
        {METRICS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={metric === m.id}
            onClick={() => setMetric(m.id)}
            className={`min-h-8 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              metric === m.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <SalesPerformanceSection
        headingId="ranking-heading"
        heading="Ranking de responsáveis"
        description="Quem está na frente no período, ordenado pela métrica escolhida acima."
        groupLabelHeader="Responsável"
        emptyMessage={EMPTY_MESSAGE}
        loadErrorMessage="Não foi possível carregar o ranking."
        fromIso={fromIso}
        toIso={toIso}
        fetchReport={getSalesPerformanceByOwner}
        renderTable={(groups) => <RankingTable groups={groups} metric={metric} emptyMessage={EMPTY_MESSAGE} />}
      />
    </div>
  )
}
