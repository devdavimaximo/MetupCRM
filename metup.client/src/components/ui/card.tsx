import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Painel do sistema (o `Surface` da LP): superfície elevada, filete, canto de 4px.
 * Sem sombra por padrão — em tema escuro a separação vem da luminância e do filete.
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn("flex flex-col rounded-sm border border-line-soft bg-surface text-fg", className)}
      {...props}
    />
  )
}

/** Cabeçalho de painel: título à esquerda, ação à direita, filete embaixo. */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line-soft px-4 py-3 sm:px-5", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 data-slot="card-title" className={cn("label-mono text-fg-muted", className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("text-sm text-muted", className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-4 py-4 sm:px-5", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center border-t border-line-soft px-4 py-3 sm:px-5", className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
