import type { ReactNode } from "react"

import { Panel, PanelHeading } from "@/components/metrics/panel"
import { numberFormatter } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { PeriodValue, ReportPeriod } from "./api"
import { deltaOf, deltaPoints, type Delta, type DeltaContext } from "@/features/dashboard/dashboard-format"

const percentFormatter = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 })
const precisePercentFormatter = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 })

export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : percentFormatter.format(value)
}

/** Uma casa decimal, para quando a diferença entre 12% e 12,4% importa (passagem entre etapas). */
export function formatPrecisePercent(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : precisePercentFormatter.format(value)
}

export function formatDays(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
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

/**
 * O contexto de comparação da tela, montado uma vez do período que o servidor devolveu. É ele que
 * faz a UI dizer "sem base de comparação" em vez de estampar +∞%.
 */
export function deltaContextOf(period: ReportPeriod): DeltaContext {
  return { historyStart: period.historyStart, previousStart: period.previousStart, periodStart: period.periodStart }
}

export function valueDelta(value: PeriodValue, period: ReportPeriod): Delta {
  return deltaOf(value, deltaContextOf(period))
}

/** Delta de uma taxa: a diferença é em pontos percentuais, não em porcentagem de porcentagem. */
export function rateDelta(current: number | null, previous: number | null, period: ReportPeriod): Delta {
  return deltaPoints(current, previous, deltaContextOf(period))
}

/** Painel de relatório: o mesmo `Panel` do dashboard, com cabeçalho e ações opcionais à direita. */
export function ReportPanel({
  id,
  title,
  subtitle,
  aside,
  children,
  className,
  bodyClassName,
}: {
  id: string
  title: string
  subtitle?: string
  aside?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <Panel aria-labelledby={id} className={cn("gap-3 px-4 py-3.5", className)}>
      <PanelHeading id={id} title={title} subtitle={subtitle} aside={aside} />
      <div className={cn("min-h-0", bodyClassName)}>{children}</div>
    </Panel>
  )
}

/**
 * Painel cujo conteúdo é uma tabela: ela sangra até a borda do painel (a tabela tem o próprio
 * padding de célula) e rola sozinha no horizontal quando não cabe.
 */
export function ReportTablePanel({
  id,
  title,
  subtitle,
  aside,
  children,
}: {
  id: string
  title: string
  subtitle?: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <Panel aria-labelledby={id} className="gap-3 py-3.5">
      <PanelHeading id={id} title={title} subtitle={subtitle} aside={aside} className="px-4" />
      {children}
    </Panel>
  )
}

/** Número de destaque dentro de um painel — Fraunces, rótulo mono, legenda curta. */
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

/** Legenda de uma série do gráfico: o ponto da cor e o nome, do mesmo jeito em toda a tela. */
export function ChartLegend({ items }: { items: { label: string; color: string; muted?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-muted">
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-full", item.muted && "opacity-60")}
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
