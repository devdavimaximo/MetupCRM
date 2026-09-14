import { getSalesPerformanceByOwner } from "./api"
import { SalesPerformanceSection } from "./SalesPerformanceSection"

type Props = {
  fromIso?: string
  toIso?: string
}

/** Conversão e ticket médio por responsável (V3, segunda fatia — seção 7 do CLAUDE.md). */
export function SalesByOwnerSection({ fromIso, toIso }: Props) {
  return (
    <SalesPerformanceSection
      headingId="sales-by-owner-heading"
      heading="Desempenho por responsável"
      description="Negócios abertos e fechados, taxa de fechamento e ticket médio de cada responsável no período."
      groupLabelHeader="Responsável"
      emptyMessage="Nenhum negócio com responsável no período selecionado."
      loadErrorMessage="Não foi possível carregar o desempenho por responsável."
      fromIso={fromIso}
      toIso={toIso}
      fetchReport={getSalesPerformanceByOwner}
    />
  )
}
