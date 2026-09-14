import { getSalesPerformanceBySegment } from "./api"
import { SalesPerformanceSection } from "./SalesPerformanceSection"

type Props = {
  fromIso?: string
  toIso?: string
}

/** Conversão e ticket médio por segmento de empresa (V3, terceira fatia — seção 7 do CLAUDE.md). */
export function SalesBySegmentSection({ fromIso, toIso }: Props) {
  return (
    <SalesPerformanceSection
      headingId="sales-by-segment-heading"
      heading="Desempenho por segmento"
      description="Negócios abertos e fechados, taxa de fechamento e ticket médio de cada segmento de empresa no período."
      groupLabelHeader="Segmento"
      emptyMessage="Nenhum negócio no período selecionado."
      loadErrorMessage="Não foi possível carregar o desempenho por segmento."
      fromIso={fromIso}
      toIso={toIso}
      fetchReport={getSalesPerformanceBySegment}
    />
  )
}
