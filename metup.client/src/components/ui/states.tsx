import * as React from "react"
import { CircleAlert, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Alerta inline — o mesmo desenho do desfecho do formulário da LP: filete lateral de
 * 2px + um véu de 10% da cor. Nunca beco sem saída: erro de carga sempre oferece retry.
 */
export function Alert({
  tone = "danger",
  children,
  onRetry,
  className,
}: {
  tone?: "danger" | "success" | "neutral"
  children: React.ReactNode
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 border-l-2 px-4 py-3 text-base text-fg",
        tone === "danger" && "border-danger bg-danger/10",
        tone === "success" && "border-success bg-success/10",
        tone === "neutral" && "border-line-strong bg-surface-2",
        className
      )}
    >
      <p className="flex min-w-0 flex-1 items-center gap-2">
        {tone === "danger" && <CircleAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />}
        {children}
      </p>
      {onRetry && (
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          Tentar de novo
        </Button>
      )}
    </div>
  )
}

/** Mensagem de erro curta junto de um formulário ou ação. */
export function InlineError({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn("text-sm font-medium text-danger", className)}>
      {children}
    </p>
  )
}

/**
 * Estado vazio: o que está acontecendo, por que está vazio e o que fazer — nessa ordem.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-16",
        className
      )}
    >
      {Icon && (
        <span className="mb-1 inline-flex size-10 items-center justify-center rounded-sm border border-line-soft bg-surface-2 text-muted">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      )}
      <p className={cn("font-medium text-fg", compact ? "text-base" : "text-lg")}>{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

/** Bloco de esqueleto — pulsa por opacidade (compositor), nunca por largura. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-skeleton rounded-xs bg-surface-3", className)} />
}

/** Lista de linhas-esqueleto com anúncio único para leitor de tela. */
export function SkeletonRows({ rows = 5, className, label = "Carregando…" }: { rows?: number; className?: string; label?: string }) {
  return (
    <div role="status" className={cn("flex flex-col", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-line-soft/60 px-4 py-3.5 last:border-b-0">
          <Skeleton className="size-8 shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-1/4" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}
