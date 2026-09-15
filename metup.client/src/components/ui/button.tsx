import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Hierarquia de ação (a mesma linguagem do botão da LP: mono em caixa alta, canto usinado):
 * - default     → primária. Dourado sólido, tinta preta. Uma por contexto.
 * - outline     → secundária. Neutra, borda legível; ganha corpo no hover.
 * - ghost       → terciária. Sem caixa até o hover.
 * - destructive → perigosa. Vermelho só no texto e na borda — nunca um bloco vermelho.
 * - link        → navegação inline.
 */
const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xs",
    "font-mono text-2xs font-medium tracking-[0.1em] uppercase",
    "transition-[color,background-color,border-color,box-shadow] duration-150 ease-out",
    "focus-visible:focus-ring disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-accent text-on-accent shadow-hairline hover:bg-accent-hover hover:shadow-glow-accent active:bg-accent-active disabled:bg-surface-3 disabled:text-muted disabled:opacity-100 disabled:shadow-none",
        outline:
          "border border-line-strong/70 bg-transparent text-fg hover:border-fg-muted hover:bg-surface-2 active:bg-surface-3",
        secondary: "bg-surface-2 text-fg hover:bg-surface-3",
        ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg",
        destructive:
          "border border-danger/50 bg-transparent text-danger hover:border-danger hover:bg-danger/10",
        link: "h-auto px-0 text-accent underline decoration-line-strong underline-offset-4 hover:decoration-accent",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3",
        lg: "h-11 px-6",
        icon: "size-9 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
