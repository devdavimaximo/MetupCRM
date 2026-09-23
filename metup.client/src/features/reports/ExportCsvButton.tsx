import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ReportPeriod } from "./api"
import { csvFileName, downloadCsv, toCsv, type CsvColumn } from "./to-csv"

type Props<T> = {
  /** Nome curto do relatório, em kebab-case — vira parte do nome do arquivo. */
  report: string
  period: ReportPeriod
  rows: readonly T[]
  columns: CsvColumn<T>[]
}

/** Baixa a tabela do painel como CSV. Sem linhas, não há o que exportar: o botão some. */
export function ExportCsvButton<T>({ report, period, rows, columns }: Props<T>) {
  if (rows.length === 0) return null

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      title="Baixar esta tabela em CSV"
      onClick={() => downloadCsv(csvFileName(report, period.periodStartLocal, period.periodEndLocal), toCsv(rows, columns))}
    >
      <Download aria-hidden="true" />
      Exportar
    </Button>
  )
}
