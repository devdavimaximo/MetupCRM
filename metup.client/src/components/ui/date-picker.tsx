import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"

import { MonthButton, MonthGrid } from "@/components/ui/date-range-picker"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { addDays, addMonths, endOfMonth, formatLongLocalDate, startOfMonth, type LocalDate } from "@/lib/local-date"
import { cn } from "@/lib/utils"

export type DatePickerShortcut = { label: string; date: LocalDate }

type Props = {
  value: LocalDate
  onChange: (date: LocalDate) => void
  /** Atalhos acima do calendário ("Hoje", "Amanhã"). */
  shortcuts?: DatePickerShortcut[]
  /** Nome do controle para leitor de tela; o valor por extenso é somado a ele. */
  label: string
  className?: string
}

/** Não há data máxima: um dia de referência no futuro é tão válido quanto um no passado. */
const NO_MAX = "9999-12-31"

/**
 * Escolha de **um** dia: pílula com a data por extenso e, no popover, atalhos e um calendário de um
 * mês (a mesma grade do `DateRangePicker`). Teclado: setas movem o dia, PageUp/PageDown o mês,
 * Enter escolhe e fecha, Esc fecha.
 */
export function DatePicker({ value, onChange, shortcuts = [], label, className }: Props) {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState<LocalDate>(value)
  const [viewMonth, setViewMonth] = useState<LocalDate>(startOfMonth(value))
  const gridRef = useRef<HTMLDivElement>(null)
  const movedByKeyboard = useRef(false)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setFocused(value)
      setViewMonth(startOfMonth(value))
    }
  }

  useEffect(() => {
    if (!movedByKeyboard.current) return
    movedByKeyboard.current = false
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus()
  }, [focused, viewMonth])

  function choose(date: LocalDate) {
    onChange(date)
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
    const next = step()
    movedByKeyboard.current = true
    setFocused(next)
    if (next < viewMonth || next > endOfMonth(viewMonth)) setViewMonth(startOfMonth(next))
  }

  const tabbable = focused >= viewMonth && focused <= endOfMonth(viewMonth) ? focused : viewMonth
  const text = formatLongLocalDate(value)

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${text}`}
          className={cn(
            "inline-flex h-10 cursor-pointer items-center gap-3 rounded-md border border-line-soft bg-surface px-4 text-sm text-fg transition-colors hover:border-line-strong focus-visible:focus-ring data-[state=open]:border-line-strong",
            className
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
          <span className="truncate tabular">{text}</span>
          <ChevronDown className="ml-auto size-4 shrink-0 text-fg-muted" aria-hidden="true" />
        </button>
      </PopoverTrigger>

      <PopoverContent aria-label={label} className="flex flex-col">
        {shortcuts.length > 0 && (
          <ul className="flex gap-1 border-b border-line-soft p-2" aria-label="Atalhos">
            {shortcuts.map((shortcut) => (
              <li key={shortcut.label}>
                <button
                  type="button"
                  aria-pressed={shortcut.date === value}
                  onClick={() => choose(shortcut.date)}
                  className={cn(
                    "cursor-pointer rounded-sm px-3 py-1.5 text-sm transition-colors hover:bg-surface-3 hover:text-fg focus-visible:focus-ring",
                    shortcut.date === value ? "bg-surface-3 text-fg" : "text-fg-muted"
                  )}
                >
                  {shortcut.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div ref={gridRef} className="p-3" onKeyDown={handleGridKeyDown}>
          <MonthGrid
            month={viewMonth}
            preview={{ from: value, to: value }}
            pendingStart={null}
            tabbable={tabbable}
            maxDate={NO_MAX}
            previous={
              <MonthButton label="Mês anterior" onClick={() => setViewMonth(addMonths(viewMonth, -1))}>
                <ChevronLeft className="size-4" aria-hidden="true" />
              </MonthButton>
            }
            next={
              <MonthButton label="Próximo mês" onClick={() => setViewMonth(addMonths(viewMonth, 1))}>
                <ChevronRight className="size-4" aria-hidden="true" />
              </MonthButton>
            }
            onSelect={choose}
            onHover={() => undefined}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
