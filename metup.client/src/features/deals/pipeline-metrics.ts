import type { Delta } from "@/components/metrics/delta"
import { numberFormatter } from "@/lib/format"
import type { DealStage, PipelineInsights, PipelineKpis } from "./api"
import { stageLabels } from "./stage-labels"

const moneyWhole = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 })

/** "R$ 12.400" — o valor por extenso, para o `title` e para o leitor de tela. */
export const formatMoneyWhole = (value: number) => moneyWhole.format(value)

export const formatPercent = (value: number) => percent.format(value)

const COMPACT_UNITS = [
  { limit: 1e9, suffix: " bi", divisor: 1e9 },
  { limit: 1e6, suffix: " mi", divisor: 1e6 },
  { limit: 1e3, suffix: " mil", divisor: 1e3 },
] as const

/**
 * Valor compacto dos KPIs: "R$ 2,86 mi", "R$ 184,2 mil", "R$ 940". Duas casas no milhão e no
 * bilhão, uma no milhar — é o que cabe nos cinco cartões em 1366px sem cortar. O número inteiro
 * continua disponível em `formatMoneyWhole`, que vai para o `title`.
 */
export function formatMoneyCompact(value: number): string {
  const sign = value < 0 ? "−" : ""
  const absolute = Math.abs(value)

  for (const unit of COMPACT_UNITS) {
    if (absolute >= unit.limit) {
      const digits = unit.suffix === " mil" ? 1 : 2
      const scaled = absolute / unit.divisor
      const text = scaled.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })
      // Espaço inquebrável depois do "R$", o mesmo do Intl: o valor não quebra em duas linhas.
      return `${sign}R$ ${text}${unit.suffix}`
    }
  }

  return `${sign}${moneyWhole.format(absolute)}`
}

/**
 * Variação de um KPI contra o período anterior. Sem período anterior (`previous = null`) ou sem o
 * número lá, é "Sem base anterior" — nunca um percentual inventado.
 */
export function kpiDelta(current: number | null, previous: number | null | undefined): Delta {
  if (current === null || previous === null || previous === undefined) return { kind: "no-base" }
  const diff = current - previous
  if (diff === 0) return { kind: "change", direction: "flat", label: "0%" }
  if (previous === 0) return { kind: "new" }
  const sign = diff > 0 ? "+" : "−"
  return {
    kind: "change",
    direction: diff > 0 ? "up" : "down",
    label: `${sign}${percent.format(Math.abs(diff) / Math.abs(previous))}`,
  }
}

/** A mesma variação para uma taxa (0–1): a diferença vai em pontos percentuais, não em %. */
export function rateDelta(current: number | null, previous: number | null | undefined): Delta {
  if (current === null || previous === null || previous === undefined) return { kind: "no-base" }
  const diff = (current - previous) * 100
  if (Math.abs(diff) < 0.05) return { kind: "change", direction: "flat", label: "0 p.p." }
  const sign = diff > 0 ? "+" : "−"
  return {
    kind: "change",
    direction: diff > 0 ? "up" : "down",
    label: `${sign}${numberFormatter.format(Math.abs(Math.round(diff * 10) / 10))} p.p.`,
  }
}

/** Série de sparkline sem buracos: os pontos nulos viram zero só para desenhar a forma. */
export const sparklineOf = (values: readonly (number | null)[]) => values.map((v) => v ?? 0)

export type KpiId = "pipelineTotal" | "forecastRevenue" | "openDeals" | "conversionRate" | "averageTicket"

export const KPI_IDS: KpiId[] = ["pipelineTotal", "forecastRevenue", "openDeals", "conversionRate", "averageTicket"]

export const kpiLabels: Record<KpiId, string> = {
  pipelineTotal: "Pipeline total",
  forecastRevenue: "Receita prevista",
  openDeals: "Negócios em aberto",
  conversionRate: "Taxa de conversão",
  averageTicket: "Ticket médio",
}

/** A fórmula de cada número, para o tooltip — todo KPI da tela diz de onde veio. */
export const kpiHints: Record<KpiId, string> = {
  pipelineTotal: "soma do valor dos negócios abertos agora (valor em negociação ou, na falta dele, o ticket)",
  forecastRevenue:
    "receita prevista ponderada: o pipeline aberto multiplicado pela taxa histórica de fechamento de cada etapa — não é a soma do que está em aberto",
  openDeals: "quantidade de negócios abertos agora. Clique para ir ao quadro",
  conversionRate:
    "conversão em coorte: dos negócios criados no período, quantos já foram ganhos. Não é a taxa de fechamento do dashboard (ganhos ÷ ganhos + perdidos). Clique para ir ao funil",
  averageTicket: "receita ganha ÷ negócios ganhos, entre os fechados no período",
}

export function kpiValue(id: KpiId, kpis: PipelineKpis): number | null {
  switch (id) {
    case "pipelineTotal":
      return kpis.pipelineTotal
    case "forecastRevenue":
      return kpis.forecastRevenue
    case "openDeals":
      return kpis.openDeals
    case "conversionRate":
      return kpis.conversionRate
    case "averageTicket":
      return kpis.averageTicket
  }
}

/** Como cada KPI aparece: o texto do cartão e o valor por extenso no `title` (nulo quando não há). */
export function kpiDisplay(id: KpiId, value: number | null): { text: string; title?: string } {
  if (value === null) return { text: "—" }
  if (id === "openDeals") return { text: numberFormatter.format(value) }
  if (id === "conversionRate") return { text: formatPercent(value) }
  return { text: formatMoneyCompact(value), title: formatMoneyWhole(value) }
}

/* ─── Frases dos insights (item 17) ─────────────────────────────────────────── */

const stageName = (stage: DealStage) => stageLabels[stage]

/** "Qualificação recebeu 18 negócios (32% das entradas)." Com empate, nomeia as etapas empatadas. */
export function volumeSentence(volume: PipelineInsights["volume"]): string {
  if (!volume) return "Nenhum negócio mudou de etapa nos últimos 30 dias."

  const names = [volume.stage, ...volume.tied].map(stageName)
  const share = volume.pctOfTotal === null ? "" : ` (${formatPercent(volume.pctOfTotal)} das entradas)`
  const count = `${numberFormatter.format(volume.entered)} ${volume.entered === 1 ? "negócio" : "negócios"}`

  return volume.tied.length === 0
    ? `${names[0]} recebeu ${count}${share}.`
    : `${names.slice(0, -1).join(", ")} e ${names.at(-1)} empataram com ${count} cada${share}.`
}

/** "De Qualificação para Reunião, 80% avançam (4 de 5)." */
export function passageSentence(passage: PipelineInsights["bestPassage"], minimumSample: number): string {
  if (!passage) {
    return `Ainda não há etapa com ${numberFormatter.format(minimumSample)} entradas no período para comparar as passagens.`
  }

  const sample = `${numberFormatter.format(passage.advanced)} de ${numberFormatter.format(passage.entered)}`
  const base = `De ${stageName(passage.fromStage)} para ${stageName(passage.toStage)}, ${formatPercent(passage.rate)} avançam (${sample}).`

  return passage.tied.length === 0 ? base : `${base} Empate com ${passage.tied.map(stageName).join(", ")}.`
}

/** "7 negócios parados há mais de 7 dias somam R$ 84.000." */
export function riskSentence(risk: PipelineInsights["risk"]): string {
  const limit = `${numberFormatter.format(risk.stalledAfterDays)} ${risk.stalledAfterDays === 1 ? "dia" : "dias"}`
  if (risk.count === 0) return `Nenhum negócio parado há mais de ${limit} de Qualificação em diante.`

  const one = risk.count === 1
  const deals = `${numberFormatter.format(risk.count)} ${one ? "negócio parado" : "negócios parados"}`
  const sum =
    risk.value > 0
      ? ` e ${one ? "soma" : "somam"} ${formatMoneyWhole(risk.value)}`
      : ` e ${one ? "está" : "estão"} sem valor informado`
  return `${deals} há mais de ${limit}${sum}.`
}
