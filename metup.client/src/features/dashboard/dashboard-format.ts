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

/** "14/09" a partir de uma data local da organização ("2026-09-14") — sem reconverter fuso. */
export function formatLocalDay(localDate: string) {
  const [year, month, day] = localDate.split("-").map(Number)
  return bucketDay.format(new Date(year, month - 1, day))
}

/** "14/09" a partir de um instante ISO (prazo de tarefa, evento) — esse sim é convertido. */
export const formatInstantDay = (iso: string) => bucketDay.format(new Date(iso))

/** "15 de setembro de 2026". */
export const formatLongDate = (date = new Date()) => longDate.format(date)

/**
 * O que dá para dizer da variação contra a janela anterior. Percentual só quando existe base real;
 * nos demais casos o cartão diz por que não há comparação, em vez de um "sem base anterior" mudo.
 */
export type Delta =
  | { kind: "change"; direction: "up" | "down" | "flat"; label: string }
  | { kind: "new" }
  | { kind: "idle" }
  | { kind: "no-history" }

/** Recorte das duas janelas e o início do histórico do escopo — vindos do overview. */
export type DeltaContext = { historyStart: string | null; previousStart: string; periodStart: string }

/** A janela anterior inteira acontece antes do primeiro negócio: não existe o que comparar. */
function hasNoBaseline({ historyStart, periodStart }: DeltaContext) {
  return historyStart === null || new Date(historyStart) >= new Date(periodStart)
}

export function deltaOf({ current, previous }: PeriodValue, context: DeltaContext): Delta {
  if (hasNoBaseline(context)) return { kind: "no-history" }
  if (previous === 0) return current > 0 ? { kind: "new" } : { kind: "idle" }

  const change = (current - previous) / previous
  if (Math.abs(change) < 0.0005) return { kind: "change", direction: "flat", label: "0%" }
  return {
    kind: "change",
    direction: change > 0 ? "up" : "down",
    label: `${change > 0 ? "+" : "−"}${percent.format(Math.abs(change))}`,
  }
}

/** Variação em pontos percentuais — para taxas, onde "% de %" confunde. */
export function deltaPoints(current: number | null, previous: number | null, context: DeltaContext): Delta {
  if (hasNoBaseline(context)) return { kind: "no-history" }
  if (previous === null) return current === null ? { kind: "idle" } : { kind: "new" }
  if (current === null) return { kind: "idle" }

  const diff = (current - previous) * 100
  if (Math.abs(diff) < 0.05) return { kind: "change", direction: "flat", label: "0 p.p." }
  return {
    kind: "change",
    direction: diff > 0 ? "up" : "down",
    label: `${diff > 0 ? "+" : "−"}${numberFormatter.format(Math.round(Math.abs(diff) * 10) / 10)} p.p.`,
  }
}

/** "18/03 – 16/06": o intervalo que a comparação usa, para o tooltip do delta. */
export function comparisonRange({ previousStart, periodStart }: DeltaContext) {
  const start = new Date(previousStart)
  const end = new Date(periodStart)
  end.setDate(end.getDate() - 1)
  return `${bucketDay.format(start)} – ${bucketDay.format(end)}`
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
