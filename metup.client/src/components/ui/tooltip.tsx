import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

function TooltipProvider({ delayDuration = 250, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
}

const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

/** Balão de popover da marca: superfície elevada, filete forte e texto curto em várias linhas. */
function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          "z-50 max-w-72 rounded-md border border-line-strong/60 bg-surface-2 px-3 py-2 text-xs whitespace-pre-line text-fg-muted shadow-raised",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0",
          className
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

/**
 * Atalho para o caso comum: um elemento com uma explicação. O filho vira o gatilho (`asChild`);
 * se ele não for focável por natureza, passe `tabIndex={0}` nele para o tooltip abrir pelo teclado.
 *
 * `openOnTap` acrescenta o toque: no celular não existe passar o ponteiro por cima, e o Radix ignora
 * de propósito o foco que veio de um ponteiro. Sem isto, todo tooltip fica inalcançável no mobile.
 * Com ponteiro de mouse o comportamento não muda — os dois manipuladores saem na frente.
 */
function Hint({
  content,
  children,
  side,
  align,
  className,
  openOnTap = false,
}: {
  content: React.ReactNode
  children: React.ReactElement
  side?: React.ComponentProps<typeof TooltipPrimitive.Content>["side"]
  align?: React.ComponentProps<typeof TooltipPrimitive.Content>["align"]
  className?: string
  /** Abre e fecha por toque, além de ponteiro e teclado. */
  openOnTap?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  // O Radix fecha no `pointerdown` do próprio gatilho, então o estado de "antes do toque" tem que
  // ser lido ali — no `pointerup` ele já viraria sempre `false`, e o tooltip nunca fecharia.
  const openBeforeTap = React.useRef(false)

  const tapProps = openOnTap
    ? {
        onPointerDown: (event: React.PointerEvent) => {
          if (event.pointerType === "touch") openBeforeTap.current = open
        },
        onPointerUp: (event: React.PointerEvent) => {
          if (event.pointerType !== "touch") return
          // Sem isto o toque ainda vira um clique fantasma no gatilho.
          event.preventDefault()
          setOpen(!openBeforeTap.current)
        },
      }
    : {}

  return (
    <Tooltip {...(openOnTap ? { open, onOpenChange: setOpen } : {})}>
      <TooltipTrigger asChild {...tapProps}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} align={align} className={className}>
        {content}
      </TooltipContent>
    </Tooltip>
  )
}

export { Hint, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
