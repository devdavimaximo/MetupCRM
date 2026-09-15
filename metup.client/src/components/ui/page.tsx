import * as React from "react"

import { cn } from "@/lib/utils"

const widths = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-[96rem]",
  full: "max-w-none",
} as const

/** Moldura de conteúdo de uma tela: goteiras e largura máxima consistentes. */
export function Page({
  width = "default",
  className,
  ...props
}: React.ComponentProps<"div"> & { width?: keyof typeof widths }) {
  return (
    <div
      className={cn("mx-auto flex w-full flex-col gap-8 px-4 pt-6 pb-12 sm:px-6 lg:px-10 lg:pt-10", widths[width], className)}
      {...props}
    />
  )
}

/**
 * Kicker acima do título — o `<Eyebrow>` da LP: mono em caixa alta, dourado, com filete.
 * Lê como prompt de terminal em vez de "label de seção" genérico.
 */
export function Eyebrow({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <p className={cn("label-mono flex items-center gap-2.5 text-accent", className)}>
      <span aria-hidden="true" className="h-px w-5 shrink-0 bg-accent" />
      {children}
    </p>
  )
}

/**
 * Cabeçalho de tela. Título em Fraunces (a voz editorial da marca), descrição curta e
 * as ações à direita. Um `<h1>` por tela.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-8 gap-y-4", className)}>
      <div className="flex min-w-0 flex-col gap-3">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-fg">{title}</h1>
        {description && <p className="max-w-2xl text-base text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 max-sm:w-full">{actions}</div>}
    </header>
  )
}

/** Título de seção dentro de uma tela ou painel: mono, discreto, com contagem opcional. */
export function SectionTitle({
  id,
  children,
  count,
  action,
  className,
  as: Tag = "h2",
}: {
  id?: string
  children: React.ReactNode
  count?: number
  action?: React.ReactNode
  className?: string
  as?: "h2" | "h3"
}) {
  return (
    <div className={cn("flex min-h-8 flex-wrap items-center justify-between gap-2", className)}>
      <Tag id={id} className="label-mono flex items-center gap-2 text-fg-muted">
        {children}
        {count !== undefined && <span className="tabular text-faint">{String(count).padStart(2, "0")}</span>}
      </Tag>
      {action}
    </div>
  )
}
