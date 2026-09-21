import { deltaTone, type Delta, type DeltaPolarity, type DeltaTone } from "@/components/metrics/delta"
import { smoothSeries } from "@/components/metrics/series"
import { numberFormatter } from "@/lib/format"
import type { DealSource } from "@/features/deals/api"
import type { PeriodValue } from "./api"

// Delta e a suavização de série moram em components/metrics (item 9 da PL3, com o KpiCard); o
// dashboard continua importando daqui, que é a fachada de formatação da tela.
export { deltaTone, smoothSeries }
export type { Delta, DeltaPolarity, DeltaTone }

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

/** Variação de contagem com absoluto e percentual ("+4 · +12%"); sem base → "no-base". */
export function countDelta(current: number, previous: number | null): Delta {
  if (previous === null) return { kind: "no-base" }
  const diff = current - previous
  if (diff === 0) return { kind: "change", direction: "flat", label: "0 · 0%" }
  const sign = diff > 0 ? "+" : "−"
  const absolute = `${sign}${numberFormatter.format(Math.abs(diff))}`
  // Sem base (0) não há percentual honesto: fica só o absoluto.
  const label = previous === 0 ? absolute : `${absolute} · ${sign}${percent.format(Math.abs(diff) / previous)}`
  return { kind: "change", direction: diff > 0 ? "up" : "down", label }
}

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
 * Cor fixa de cada origem, na família dourado → neutros: a identidade segue a origem, não a posição
 * na lista, então "WhatsApp" tem a mesma cor em qualquer período. Vizinhos de tom próximo são
 * separados pelo espaço entre fatias e pela legenda.
 */
export const SOURCE_COLORS: Record<DealSource, string> = {
  Sdr: "#f5a623",
  WhatsApp: "#c98f3a",
  MetaAds: "#b9b6b1",
  Outbound: "#e9c47e",
  Indicacao: "#9a6a2c",
  Site: "#8a857d",
  LinkedIn: "#dcd7cf",
  Evento: "#6e6a64",
  Outro: "#4f4d4a",
}

/** A fatia que junta as menores origens quando há mais origens do que o donut mostra. */
export const OTHER_SOURCES_COLOR = "#3a3b3e"

/** Máximo de fatias do donut; acima disso as menores somam em "Outras". */
export const MAX_ORIGIN_SLICES = 6
