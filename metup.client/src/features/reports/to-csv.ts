/**
 * Exportação de tabela de relatório em CSV, montada no navegador a partir dos dados já carregados
 * — o arquivo traz exatamente o que está na tela, sem uma segunda ida ao servidor que poderia
 * devolver outros números.
 *
 * Separador `;` e decimal com vírgula: é o que o Excel em pt-BR abre sem pedir importação.
 */
export type CsvColumn<T> = {
  header: string
  /** Texto já pronto (rótulo), número (formatado com vírgula) ou `null` para célula vazia. */
  value: (row: T) => string | number | null
}

const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2, useGrouping: false })

function escapeCell(value: string | number | null): string {
  if (value === null) return ""
  const text = typeof value === "number" ? numberFormatter.format(value) : value
  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv<T>(rows: readonly T[], columns: CsvColumn<T>[]): string {
  const lines = [
    columns.map((column) => escapeCell(column.header)).join(";"),
    ...rows.map((row) => columns.map((column) => escapeCell(column.value(row))).join(";")),
  ]
  return lines.join("\r\n")
}

/** Nome de arquivo previsível e ordenável: `metup-<relatorio>-<de>-a-<ate>.csv`. */
export function csvFileName(report: string, from: string, to: string) {
  return `metup-${report}-${from}-a-${to}.csv`
}

export function downloadCsv(fileName: string, csv: string) {
  // BOM: sem ele o Excel abre acentuação quebrada.
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
