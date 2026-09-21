import type { ComponentProps, ReactNode, Ref } from "react"
import { ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"

/** A superfície dos painéis e dos KPIs — canto de 10px, filete discreto e um véu de luz no topo. */
export const panelSurface =
  "relative flex min-h-0 min-w-0 flex-col rounded-lg border border-line-soft bg-linear-to-b from-surface-2/70 to-surface"

export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn(panelSurface, className)} {...props} />
}

export function PanelHeading({
  id,
  title,
  subtitle,
  aside,
  className,
}: {
  id: string
  title: string
  subtitle?: string
  aside?: ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2 xl:flex-nowrap", className)}>
      <div className="min-w-0">
        <h2 id={id} className="truncate text-md font-medium text-fg">
          {title}
        </h2>
        {subtitle && <p className="truncate text-xs text-fg-muted">{subtitle}</p>}
      </div>
      {aside}
    </header>
  )
}

export function SeeAll({
  onClick,
  children = "Ver todas",
  ref,
}: {
  onClick: () => void
  children?: ReactNode
  ref?: Ref<HTMLButtonElement>
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xs text-xs text-accent transition-colors hover:text-accent-hover focus-visible:focus-ring"
    >
      {children}
      <ArrowRight className="size-3" aria-hidden="true" />
    </button>
  )
}
