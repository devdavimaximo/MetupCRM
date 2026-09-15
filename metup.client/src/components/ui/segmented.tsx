import type { KeyboardEvent } from "react"

import { cn } from "@/lib/utils"

type Option<T extends string> = { value: T; label: string; count?: number }

/**
 * Controle segmentado (radiogroup) para alternar uma visão — Pendentes/Concluídas,
 * métrica do ranking. Setas do teclado movem a seleção, como um radio nativo.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return
    event.preventDefault()
    const index = options.findIndex((o) => o.value === value)
    const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1
    const next = options[(index + delta + options.length) % options.length]
    onChange(next.value)
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]")
    buttons[options.indexOf(next)]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cn("inline-flex h-9 w-fit items-stretch rounded-xs border border-line-soft bg-surface p-0.5", className)}
    >
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "label-mono inline-flex cursor-pointer items-center gap-2 rounded-[1px] px-3 transition-colors focus-visible:focus-ring",
              isActive ? "bg-surface-3 text-fg shadow-hairline" : "text-muted hover:text-fg"
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={cn("tabular", isActive ? "text-accent" : "text-faint")}>{option.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
