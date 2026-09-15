/**
 * Datas de calendário ("2026-09-15") sem fuso nem hora — o dia como a organização o chama.
 * Toda conta é feita em data local do navegador só como aritmética de calendário; nada aqui
 * representa um instante.
 */
export type LocalDate = string

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isLocalDate(value: string | null | undefined): value is LocalDate {
  if (!value || !LOCAL_DATE_PATTERN.test(value)) return false
  return toLocalDate(parseLocalDate(value)) === value
}

export function parseLocalDate(value: LocalDate): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function toLocalDate(date: Date): LocalDate {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

export const todayLocal = (): LocalDate => toLocalDate(new Date())

export function addDays(value: LocalDate, days: number): LocalDate {
  const date = parseLocalDate(value)
  date.setDate(date.getDate() + days)
  return toLocalDate(date)
}

export function addMonths(value: LocalDate, months: number): LocalDate {
  const date = parseLocalDate(value)
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDay))
  return toLocalDate(date)
}

export const startOfMonth = (value: LocalDate): LocalDate => `${value.slice(0, 7)}-01`

export function endOfMonth(value: LocalDate): LocalDate {
  const date = parseLocalDate(value)
  return toLocalDate(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

/** Dias corridos entre as duas datas, contando as duas pontas. */
export function daysInclusive(from: LocalDate, to: LocalDate) {
  return Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86_400_000) + 1
}

const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" })
const dayMonthYear = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" })

const fullDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })

/** "01/10/2026" a partir de uma data local ("2026-10-01") — sem reconverter fuso. */
export const formatLocalDate = (value: LocalDate) => fullDate.format(parseLocalDate(value))

const clean = (text: string) => text.replace(/\./g, "").replace(/ de /g, " ")

/** "16 ago – 15 set 2026": dia e mês nas duas pontas; o ano só se repete quando muda. */
export function formatLocalRange(from: LocalDate, to: LocalDate) {
  const start = parseLocalDate(from)
  const end = parseLocalDate(to)
  if (from === to) return clean(dayMonthYear.format(start))
  const startText = start.getFullYear() === end.getFullYear() ? dayMonth.format(start) : dayMonthYear.format(start)
  return `${clean(startText)} – ${clean(dayMonthYear.format(end))}`
}
