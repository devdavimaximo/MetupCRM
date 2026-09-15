const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" })
const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})
const longDayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" })

export const numberFormatter = new Intl.NumberFormat("pt-BR")

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function dayDiff(date: Date, reference = new Date()) {
  return Math.round((startOfDay(date).getTime() - startOfDay(reference).getTime()) / 86_400_000)
}

/** "Hoje, 14:00" · "Ontem, 09:30" · "Amanhã, 10:00" · "12 set, 16:00". */
export function formatDue(iso: string): string {
  const date = new Date(iso)
  const diff = dayDiff(date)
  const time = timeFormatter.format(date)
  if (diff === 0) return `Hoje, ${time}`
  if (diff === -1) return `Ontem, ${time}`
  if (diff === 1) return `Amanhã, ${time}`
  return `${shortDateFormatter.format(date).replace(".", "")}, ${time}`
}

/** "há 3 dias" para prazos vencidos; null quando ainda não venceu. */
export function formatOverdue(iso: string): string | null {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  if (diffMs <= 0) return null
  const days = -dayDiff(date)
  if (days >= 1) return days === 1 ? "há 1 dia" : `há ${days} dias`
  const hours = Math.floor(diffMs / 3_600_000)
  if (hours >= 1) return `há ${hours}h`
  return `há ${Math.max(1, Math.floor(diffMs / 60_000))} min`
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso)).replace(".", "")
}

export function formatShortDate(iso: string): string {
  return shortDateFormatter.format(new Date(iso)).replace(".", "")
}

/** "segunda-feira, 14 de setembro". */
export function formatLongToday(date = new Date()): string {
  return longDayFormatter.format(date)
}

/** Tempo relativo curto para listas de conversa. */
export function formatRelative(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return "agora"
  if (diffMin < 60) return `${diffMin} min`
  const diffHours = Math.round(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d`
  return formatShortDate(iso)
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${numberFormatter.format(count)} ${count === 1 ? singular : plural}`
}
