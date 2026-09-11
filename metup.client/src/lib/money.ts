const formatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

/** Dinheiro sempre em decimal (regra 4.7 do CLAUDE.md) — nunca aproxima em ponto flutuante aqui. */
export function formatMoney(value: number | null): string {
  return value === null ? "—" : formatter.format(value)
}

/** Converte texto de formulário em número decimal ou null — vazio nunca vira zero. */
export function parseMoney(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const normalized = trimmed.replace(/\./g, "").replace(",", ".")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}
