import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * O controle de texto do sistema — o mesmo desenho do campo da LP: preenchimento
 * discreto, filete embaixo (line-strong, 3.39:1 — WCAG 1.4.11), dourado no foco e
 * vermelho no erro. Fonte de 16px no mobile para o Safari não dar zoom ao focar.
 */
export const controlClasses = cn(
  "w-full min-w-0 rounded-t-xs rounded-b-none border-0 border-b border-b-line-strong bg-surface-2 px-3 text-md text-fg md:text-base",
  "transition-[border-color,background-color] duration-150 ease-out outline-none",
  "placeholder:text-faint hover:border-b-fg-muted",
  "focus-visible:border-b-accent focus-visible:bg-surface-3 focus-visible:focus-ring",
  "aria-invalid:border-b-danger",
  "disabled:cursor-not-allowed disabled:opacity-50"
)

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(controlClasses, "h-10", className)} {...props} />
}

export { Input }
