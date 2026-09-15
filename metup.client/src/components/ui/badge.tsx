import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Tag e status. Cor comunica intenção, nunca decora:
 * - outline/default → metadado neutro (origem, segmento)
 * - accent          → o que exige atenção comercial agora (hoje, em aberto)
 * - success/danger  → desfecho (ganho, perdido, atrasado)
 * `dot` acrescenta um ponto de cor — o sinal não depende só do texto nem só da cor.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-xs border px-1.5 py-px font-mono text-2xs font-medium tracking-[0.06em] whitespace-nowrap uppercase [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-surface-3 text-fg-muted",
        outline: "border-line-soft text-muted",
        accent: "border-accent/30 bg-accent/10 text-accent",
        success: "border-success/30 bg-success/10 text-success",
        danger: "border-danger/30 bg-danger/10 text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  dot = false,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props}>
      {dot && <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
