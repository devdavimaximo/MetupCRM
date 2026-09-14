import type { DealSource } from "@/features/deals/api"
import { sourceLabels } from "@/features/deals/stage-labels"
import { getSalesPerformanceBySource } from "./api"
import type { SalesPerformanceGroup } from "./api"
import { SalesPerformanceSection } from "./SalesPerformanceSection"

type Props = {
  fromIso?: string
  toIso?: string
}

function withPortugueseLabel(group: SalesPerformanceGroup): SalesPerformanceGroup {
  return { ...group, groupLabel: sourceLabels[group.groupKey as DealSource] ?? group.groupLabel }
}

/** Conversão e ticket médio por origem do negócio (V3, terceira fatia — seção 7 do CLAUDE.md). */
export function SalesBySourceSection({ fromIso, toIso }: Props) {
  return (
    <SalesPerformanceSection
      headingId="sales-by-source-heading"
      heading="Desempenho por origem"
      description="Negócios abertos e fechados, taxa de fechamento e ticket médio de cada origem no período."
      groupLabelHeader="Origem"
      emptyMessage="Nenhum negócio no período selecionado."
      loadErrorMessage="Não foi possível carregar o desempenho por origem."
      fromIso={fromIso}
      toIso={toIso}
      fetchReport={getSalesPerformanceBySource}
      mapGroup={withPortugueseLabel}
    />
  )
}
