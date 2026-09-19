import type { DealBoardCard } from "./api"

/**
 * O "há Xh" do cartão: tempo desde a última atividade; sem atividade, desde a entrada na etapa
 * (decisão 3 do plano do Pipeline — o fallback é apresentação e fica aqui, não no servidor).
 */
export function lastTouchOf(card: Pick<DealBoardCard, "lastActivityAt" | "stageEnteredAt">) {
  return card.lastActivityAt
    ? { iso: card.lastActivityAt, kind: "activity" as const }
    : { iso: card.stageEnteredAt, kind: "stage" as const }
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Relativo curto: "agora", "há 12 min", "há 5h", "há 3d", "há 2 meses". Futuro (relógio adiantado) = "agora". */
export function formatAge(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime()
  if (diff < MINUTE) return "agora"
  if (diff < HOUR) return `há ${Math.floor(diff / MINUTE)} min`
  if (diff < DAY) return `há ${Math.floor(diff / HOUR)}h`
  const days = Math.floor(diff / DAY)
  if (days < 45) return `há ${days}d`
  const months = Math.round(days / 30)
  return months === 1 ? "há 1 mês" : `há ${months} meses`
}

const fullDateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

/** O `title` do "há Xh": a data completa e de onde ela veio. */
export function ageTitle(card: Pick<DealBoardCard, "lastActivityAt" | "stageEnteredAt">): string {
  const touch = lastTouchOf(card)
  const when = fullDateTime.format(new Date(touch.iso))
  return touch.kind === "activity" ? `Última atividade em ${when}` : `Sem atividade. Na etapa desde ${when}`
}

/** "Parado há 12 d" — dias na etapa, do servidor. */
export const stalledLabel = (days: number) => `Parado há ${days} d`
