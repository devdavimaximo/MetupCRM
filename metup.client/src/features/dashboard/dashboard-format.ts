import { numberFormatter } from "@/lib/format"
import type { PeriodValue } from "./api"

const moneyWhole = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
const moneyCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
})
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 })
const bucketDay = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" })
const longDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" })

/** Valor de painel: sem centavos — o centavo é da ficha do negócio, não da leitura de 10 segundos. */
export const formatMoneyWhole = (value: number) => moneyWhole.format(value)

/** Eixos e rótulos apertados: "R$ 184,2 mil". */
export const formatMoneyCompact = (value: number) => moneyCompact.format(value)

export const formatPercent = (value: number) => percent.format(value)

/** "14/09" — rótulo de eixo. */
export const formatBucket = (iso: string) => bucketDay.format(new Date(iso))

/** "15 de setembro de 2026". */
export const formatLongDate = (date = new Date()) => longDate.format(date)

export type Delta = { direction: "up" | "down" | "flat"; label: string } | null

/** Variação contra a janela anterior. Sem base anterior não há percentual honesto — devolve null. */
export function deltaOf({ current, previous }: PeriodValue): Delta {
  if (previous === 0) return null
  const change = (current - previous) / previous
  if (Math.abs(change) < 0.0005) return { direction: "flat", label: "0%" }
  return { direction: change > 0 ? "up" : "down", label: `${change > 0 ? "+" : "−"}${percent.format(Math.abs(change))}` }
}

/** Variação em pontos percentuais — para taxas, onde "% de %" confunde. */
export function deltaPoints(current: number | null, previous: number | null): Delta {
  if (current === null || previous === null) return null
  const diff = (current - previous) * 100
  if (Math.abs(diff) < 0.05) return { direction: "flat", label: "0 p.p." }
  return {
    direction: diff > 0 ? "up" : "down",
    label: `${diff > 0 ? "+" : "−"}${numberFormatter.format(Math.round(Math.abs(diff) * 10) / 10)} p.p.`,
  }
}

export function closeRate(won: number, lost: number): number | null {
  return won + lost === 0 ? null : won / (won + lost)
}

/**
 * Suaviza a forma de uma série para desenho (média móvel ponderada, janela proporcional ao
 * tamanho). Só a curva usa isto — valores de tooltip e KPIs continuam sendo os reais.
 * Mantém primeiro e último ponto para a linha começar e terminar no valor verdadeiro.
 */
export function smoothSeries(values: number[], strength = 0.12): number[] {
  const radius = Math.max(1, Math.round(values.length * strength))
  if (values.length < 4) return values
  return values.map((_, i) => {
    if (i === 0 || i === values.length - 1) return values[i]
    const reach = Math.min(radius, i, values.length - 1 - i)
    let weighted = 0
    let weights = 0
    for (let offset = -reach; offset <= reach; offset++) {
      const weight = reach + 1 - Math.abs(offset)
      weighted += values[i + offset] * weight
      weights += weight
    }
    return weighted / weights
  })
}

/** Tons da mesma família dourada → neutros: identidade por posição fixa, nunca arco-íris. */
export const DONUT_COLORS = ["#f5a623", "#c98f3a", "#b9b6b1", "#8a857d", "#5c5a57", "#3a3b3e"]

export const periodOptions = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 3 meses" },
  { value: "180", label: "Últimos 6 meses" },
] as const

export type PeriodValueKey = (typeof periodOptions)[number]["value"]
