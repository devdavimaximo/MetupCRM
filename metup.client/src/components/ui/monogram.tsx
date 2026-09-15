import { cn } from "@/lib/utils"

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0][0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : (parts[0][1] ?? "")
  return (first + last).toUpperCase()
}

const sizes = {
  xs: "size-6 text-[0.625rem]",
  sm: "size-8 text-2xs",
  md: "size-10 text-xs",
  lg: "size-12 text-sm",
} as const

/**
 * Monograma de pessoa/empresa. Quadrado de canto usinado (não círculo de avatar genérico),
 * iniciais em mono. Decorativo: o nome sempre aparece em texto ao lado.
 */
export function Monogram({
  name,
  size = "sm",
  className,
}: {
  name: string
  size?: keyof typeof sizes
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm border border-line-soft bg-surface-2 font-mono font-medium tracking-wide text-fg-muted select-none",
        sizes[size],
        className
      )}
    >
      {initialsOf(name)}
    </span>
  )
}
