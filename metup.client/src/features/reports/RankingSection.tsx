import { useState } from "react"

import { SegmentedControl } from "@/components/ui/segmented"
import { getSalesPerformanceByOwner } from "./api"
import { RankingTable, type RankingMetric } from "./RankingTable"
import { SalesPerformanceSection } from "./SalesPerformanceSection"

type Props = {
  fromIso?: string
  toIso?: string
}

const METRICS: { value: RankingMetric; label: string }[] = [
  { value: "totalRevenue", label: "Receita" },
  { value: "closeRate", label: "Fechamento" },
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
    <SalesPerformanceSection
      headingId="ranking-heading"
      heading="Ranking de responsáveis"
      description="Quem está na frente no período, ordenado pela métrica escolhida."
      headingAside={<SegmentedControl label="Ordenar ranking por" options={METRICS} value={metric} onChange={setMetric} />}
      groupLabelHeader="Responsável"
      emptyMessage={EMPTY_MESSAGE}
      loadErrorMessage="Não foi possível carregar o ranking."
      fromIso={fromIso}
      toIso={toIso}
      fetchReport={getSalesPerformanceByOwner}
      renderTable={(groups) => <RankingTable groups={groups} metric={metric} emptyMessage={EMPTY_MESSAGE} />}
    />
  )
}
