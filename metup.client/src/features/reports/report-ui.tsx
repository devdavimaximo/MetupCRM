import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

const percentFormatter = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 })
const numberFormatter = new Intl.NumberFormat("pt-BR")

export function formatPercent(value: number | null): string {
  return value === null ? "—" : percentFormatter.format(value)
}

export function formatDays(value: number | null): string {
  if (value === null) return "—"
  const rounded = Math.round(value * 10) / 10
  return `${numberFormatter.format(rounded)} ${rounded === 1 ? "dia" : "dias"}`
}

/** Taxa de fechamento: verde quando saudável, vermelho quando crítica, neutro no meio — sem arco-íris. */
export function closeRateTone(value: number | null): string {
  if (value === null) return "text-faint"
  if (value >= 0.5) return "text-success"
  if (value < 0.25) return "text-danger"
  return "text-fg"
}

/** Cabeçalho de um relatório: o que ele responde, em uma frase. */
export function ReportHeading({
  id,
  title,
  description,
  aside,
}: {
  id: string
  title: string
  description: string
  aside?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex max-w-2xl flex-col gap-1">
        <h2 id={id} className="text-lg font-medium text-fg">
          {title}
        </h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {aside}
    </div>
  )
}

/** Número de destaque de um relatório — Fraunces, rótulo mono, legenda curta. */
export function Metric({
  label,
  value,
  caption,
  tone = "default",
  className,
}: {
  label: ReactNode
  value: ReactNode
  caption?: ReactNode
  tone?: "default" | "accent"
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2 px-5 py-5 sm:px-6", className)}>
      <p className={cn("label-mono", tone === "accent" ? "text-accent" : "text-muted")}>{label}</p>
      <p
        className={cn(
          "font-display text-2xl font-semibold tracking-[-0.02em] break-words tabular sm:text-3xl",
          tone === "accent" ? "text-accent" : "text-fg"
        )}
      >
        {value}
      </p>
      {caption && <p className="text-sm text-muted">{caption}</p>}
    </div>
  )
}
