import { addDays, parseLocalDate, type LocalDate } from "@/lib/local-date"
import type { RecentEvent } from "./api"

const dayWithMonth = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" })
const dayWithYear = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" })

/**
 * "Hoje", "Ontem", "12 de setembro" (com o ano só quando não é o ano corrente). As duas datas são dias
 * locais da organização, vindos do servidor: nada aqui depende do fuso do navegador.
 */
export function dayLabel(day: LocalDate, today: LocalDate) {
  if (day === today) return "Hoje"
  if (day === addDays(today, -1)) return "Ontem"
  return (day.slice(0, 4) === today.slice(0, 4) ? dayWithMonth : dayWithYear).format(parseLocalDate(day))
}

export type FeedDayGroup = { key: LocalDate; label: string; events: RecentEvent[] }

/** Agrupa o feed (já em ordem decrescente) pelo dia local da organização de cada item. */
export function groupByDay(events: RecentEvent[], today: LocalDate): FeedDayGroup[] {
  const groups: FeedDayGroup[] = []
  for (const event of events) {
    const key = event.occurredOnLocal
    const last = groups.at(-1)
    if (last?.key === key) last.events.push(event)
    else groups.push({ key, label: dayLabel(key, today), events: [event] })
  }
  return groups
}
