import type { ComponentType, KeyboardEvent } from "react"

import { cn } from "@/lib/utils"

export type Choice<T extends string> = {
  value: T
  label: string
  icon?: ComponentType<{ className?: string }>
}

const chipBase =
  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xs border px-2.5 text-sm transition-colors focus-visible:focus-ring disabled:cursor-default disabled:opacity-45"
const chipActive = "border-accent/60 bg-accent/10 text-fg"
const chipIdle = "border-line-soft bg-surface-2 text-fg-muted hover:border-line-strong hover:text-fg"

/**
 * Escolha **múltipla** entre poucas opções fixas (filtros): o mesmo chip do `ChoiceChips`, mas cada
 * um é um botão de alternância (`aria-pressed`) dentro de um grupo rotulado. Nada marcado = sem filtro.
 */
export function ToggleChips<T extends string>({
  label,
  options,
  values,
  onChange,
  disabled,
  className,
}: {
  label: string
  options: Choice<T>[]
  values: T[]
  onChange: (values: T[]) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((option) => {
        const isActive = values.includes(option.value)
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            disabled={disabled}
            onClick={() => onChange(isActive ? values.filter((v) => v !== option.value) : [...values, option.value])}
            className={cn(chipBase, isActive ? chipActive : chipIdle)}
          >
            {Icon && <Icon className={cn("size-3.5", isActive ? "text-accent" : "text-muted")} />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Escolha única entre poucas opções fixas, em chips — um toque em vez de abrir um select.
 * É um radiogroup de verdade: Tab entra no grupo, setas movem a seleção.
 */
export function ChoiceChips<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
  invalid,
  describedBy,
  className,
}: {
  id: string
  label: string
  options: Choice<T>[]
  value: T | ""
  onChange: (value: T) => void
  invalid?: boolean
  describedBy?: string
  className?: string
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return
    event.preventDefault()
    const index = Math.max(0, options.findIndex((o) => o.value === value))
    const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1
    const nextIndex = value === "" ? 0 : (index + delta + options.length) % options.length
    onChange(options[nextIndex].value)
    event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]")[nextIndex]?.focus()
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onKeyDown={handleKeyDown}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {options.map((option, index) => {
        const isActive = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive || (value === "" && index === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(chipBase, isActive ? chipActive : cn(chipIdle, invalid && "border-danger/50"))}
          >
            {Icon && <Icon className={cn("size-3.5", isActive ? "text-accent" : "text-muted")} />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
