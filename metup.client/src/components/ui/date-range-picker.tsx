import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  addDays,
  addMonths,
  daysInclusive,
  endOfMonth,
  parseLocalDate,
  startOfMonth,
  toLocalDate,
  type LocalDate,
} from "@/lib/local-date"
import { cn } from "@/lib/utils"

export type DateRange = { from: LocalDate; to: LocalDate }
export type DateRangePreset = { id: string; label: string }

type Props = {
  /** Texto do gatilho: o nome do atalho ou o intervalo formatado. */
  label: string
  presets: DateRangePreset[]
  activePresetId: string | null
  /** O intervalo aplicado — o calendário abre nele. */
  range: DateRange
  /** Última data selecionável (hoje, no calendário da organização). */
  maxDate: LocalDate
  maxDays: number
  onPresetSelect: (presetId: string) => void
  onRangeSelect: (range: DateRange) => void
  className?: string
}

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"]
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]
const monthTitle = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
const fullDate = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

/**
 * Seletor de período: atalhos à esquerda, calendário de dois meses (um no celular) à direita.
 * Primeiro clique marca o início, o segundo o fim — e aplica. Teclado: setas movem o dia
 * (PageUp/PageDown o mês), Enter seleciona, Esc fecha.
 */
export function DateRangePicker({
  label,
  presets,
  activePresetId,
  range,
  maxDate,
  maxDays,
  onPresetSelect,
  onRangeSelect,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState<LocalDate | null>(null)
  const [hovered, setHovered] = useState<LocalDate | null>(null)
  const [focused, setFocused] = useState<LocalDate>(range.to)
  const [viewMonth, setViewMonth] = useState<LocalDate>(startOfMonth(range.to))
  const [error, setError] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const movedByKeyboard = useRef(false)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setDraftFrom(null)
      setHovered(null)
      setError(null)
      setFocused(range.to)
      setViewMonth(startOfMonth(range.to))
    }
  }

  useEffect(() => {
    if (!movedByKeyboard.current) return
    movedByKeyboard.current = false
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus()
  }, [focused, viewMonth])

  const leftMonth = addMonths(viewMonth, -1)
  // Um único dia entra no Tab: o focado, se estiver visível; senão o 1º dia do mês da direita.
  const tabbable = focused >= leftMonth && focused <= endOfMonth(viewMonth) ? focused : viewMonth

  function moveFocus(next: LocalDate) {
    const clamped = next > maxDate ? maxDate : next
    movedByKeyboard.current = true
    setFocused(clamped)
    if (clamped > endOfMonth(viewMonth)) setViewMonth(startOfMonth(clamped))
    else if (clamped < leftMonth) setViewMonth(startOfMonth(addMonths(clamped, 1)))
  }

  function select(date: LocalDate) {
    if (date > maxDate) return
    setFocused(date)
    if (draftFrom === null) {
      setDraftFrom(date)
      setError(null)
      return
    }

    const next = date < draftFrom ? { from: date, to: draftFrom } : { from: draftFrom, to: date }
    if (daysInclusive(next.from, next.to) > maxDays) {
      setError(`O período pode ter no máximo ${maxDays} dias.`)
      return
    }

    onRangeSelect(next)
    setOpen(false)
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, () => LocalDate> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => addMonths(focused, -1),
      PageDown: () => addMonths(focused, 1),
    }
    const step = steps[event.key]
    if (!step) return
    event.preventDefault()
    moveFocus(step())
  }

  // Durante a seleção, o intervalo acompanha o ponteiro/foco; fora dela, mostra o aplicado.
  const preview: DateRange | null = draftFrom
    ? (() => {
        const end = hovered ?? focused
        return end < draftFrom ? { from: end, to: draftFrom } : { from: draftFrom, to: end }
      })()
    : range

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Período de análise: ${label}`}
          className={cn(
            "inline-flex h-10 cursor-pointer items-center gap-3 rounded-md border border-line-soft bg-surface px-4 text-sm text-fg transition-colors hover:border-line-strong focus-visible:focus-ring data-[state=open]:border-line-strong",
            className
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
          <span className="truncate tabular">{label}</span>
          <ChevronDown className="ml-auto size-4 shrink-0 text-fg-muted" aria-hidden="true" />
        </button>
      </PopoverTrigger>

      <PopoverContent aria-label="Escolher período" className="flex max-w-[calc(100vw-1.5rem)] flex-col sm:flex-row">
        <ul className="flex shrink-0 gap-1 overflow-x-auto border-line-soft p-2 max-sm:border-b sm:w-44 sm:flex-col sm:border-r" aria-label="Atalhos">
          {presets.map((preset) => {
            const active = preset.id === activePresetId
            return (
              <li key={preset.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    onPresetSelect(preset.id)
                    setOpen(false)
                  }}
                  className={cn(
                    "w-full cursor-pointer rounded-sm px-3 py-2 text-left text-sm whitespace-nowrap transition-colors hover:bg-surface-3 hover:text-fg focus-visible:focus-ring",
                    active ? "bg-surface-3 text-fg" : "text-fg-muted"
                  )}
                >
                  {preset.label}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="flex flex-col gap-3 p-3">
          <div ref={gridRef} className="flex gap-6" onKeyDown={handleGridKeyDown} onMouseLeave={() => setHovered(null)}>
            {[leftMonth, viewMonth].map((month, index) => (
              <MonthGrid
                key={month}
                month={month}
                className={index === 0 ? "max-sm:hidden" : undefined}
                preview={preview}
                pendingStart={draftFrom}
                tabbable={tabbable}
                maxDate={maxDate}
                // "Anterior" fica no mês da esquerda; no celular (um mês só) ele desce para o da direita.
                previous={
                  <MonthButton
                    label="Mês anterior"
                    className={index === 1 ? "sm:invisible" : undefined}
                    onClick={() => setViewMonth(addMonths(viewMonth, -1))}
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </MonthButton>
                }
                next={
                  index === 1 ? (
                    <MonthButton
                      label="Próximo mês"
                      disabled={endOfMonth(viewMonth) >= maxDate}
                      onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                    >
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </MonthButton>
                  ) : (
                    <span className="size-7" />
                  )
                }
                onSelect={select}
                onHover={setHovered}
              />
            ))}
          </div>

          <p aria-live="polite" className={cn("min-h-4.5 text-xs", error ? "text-danger" : "text-muted")}>
            {error ?? (draftFrom ? "Agora escolha a data final." : "Escolha a data inicial e a final.")}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function MonthButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 cursor-pointer items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg focus-visible:focus-ring disabled:cursor-default disabled:text-faint disabled:hover:bg-transparent",
        className
      )}
    >
      {children}
    </button>
  )
}

export type DayAnnotation = { dot: "open" | "overdue" | null; description?: string }

export function MonthGrid({
  month,
  preview,
  pendingStart,
  tabbable,
  maxDate,
  previous,
  next,
  className,
  onSelect,
  onHover,
  annotate,
}: {
  month: LocalDate
  preview: DateRange | null
  pendingStart: LocalDate | null
  /** O único dia que entra no Tab (roving tabindex). */
  tabbable: LocalDate
  maxDate: LocalDate
  previous: ReactNode
  next: ReactNode
  className?: string
  onSelect: (date: LocalDate) => void
  onHover: (date: LocalDate | null) => void
  /**
   * Marcador opcional por dia (ex.: tarefas no calendário lateral): um ponto sob o número e um
   * complemento no nome acessível. Com ele, "hoje" vira anel para não disputar o ponto.
   */
  annotate?: (date: LocalDate) => DayAnnotation | null
}) {
  const first = parseLocalDate(month)
  const leading = first.getDay()
  const total = parseLocalDate(endOfMonth(month)).getDate()
  const cells: (LocalDate | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: total }, (_, i) => toLocalDate(new Date(first.getFullYear(), first.getMonth(), i + 1))),
  ]
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, w) => cells.slice(w * 7, w * 7 + 7))
  const today = toLocalDate(new Date())
  const titleId = `month-${month}`

  return (
    <div className={cn("flex w-63 flex-col gap-2", className)}>
      <div className="flex h-7 items-center justify-between">
        {previous}
        <p id={titleId} className="flex-1 text-center text-sm font-medium text-fg capitalize">
          {monthTitle.format(first)}
        </p>
        {next}
      </div>

      <div role="grid" aria-labelledby={titleId} className="flex flex-col gap-0.5">
        <div role="row" className="grid grid-cols-7">
          {WEEKDAYS.map((day, i) => (
            <span key={i} role="columnheader" aria-label={WEEKDAY_NAMES[i]} className="py-1 text-center text-2xs text-muted">
              {day}
            </span>
          ))}
        </div>
        {weeks.map((week, w) => (
          <div key={w} role="row" className="grid grid-cols-7">
            {week.map((date, d) => {
              if (!date) return <span key={`blank-${d}`} role="gridcell" />
              const disabled = date > maxDate
              const isStart = preview?.from === date || pendingStart === date
              const isEnd = preview?.to === date
              const inRange = preview !== null && date >= preview.from && date <= preview.to
              const edge = isStart || isEnd
              const note = annotate?.(date) ?? null
              const isToday = date === today
              const dayName = fullDate.format(parseLocalDate(date))
              return (
                <div
                  key={date}
                  role="gridcell"
                  aria-selected={inRange}
                  className={cn(inRange && "bg-accent/12", isStart && "rounded-l-sm", isEnd && "rounded-r-sm")}
                >
                  <button
                    type="button"
                    data-date={date}
                    tabIndex={date === tabbable ? 0 : -1}
                    disabled={disabled}
                    aria-label={note?.description ? `${dayName}, ${note.description}` : dayName}
                    aria-current={isToday ? "date" : undefined}
                    onClick={() => onSelect(date)}
                    onMouseEnter={() => onHover(disabled ? null : date)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        onSelect(date)
                      }
                    }}
                    className={cn(
                      "relative mx-auto flex size-9 cursor-pointer items-center justify-center rounded-sm text-sm tabular transition-colors focus-visible:focus-ring",
                      edge ? "bg-accent font-medium text-on-accent" : inRange ? "text-fg hover:bg-surface-3" : "text-fg-muted hover:bg-surface-3 hover:text-fg",
                      disabled && "cursor-default text-faint hover:bg-transparent hover:text-faint",
                      annotate && isToday && !edge && "ring-1 ring-accent ring-inset"
                    )}
                  >
                    {Number(date.slice(8))}
                    {!annotate && isToday && !edge && (
                      <span aria-hidden="true" className="absolute bottom-1 size-1 rounded-full bg-fg-muted" />
                    )}
                    {note?.dot && (
                      <span
                        aria-hidden="true"
                        data-dot={note.dot}
                        className={cn(
                          "absolute bottom-1 size-1 rounded-full",
                          note.dot === "overdue" ? "bg-danger" : edge ? "bg-on-accent" : "bg-accent"
                        )}
                      />
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
