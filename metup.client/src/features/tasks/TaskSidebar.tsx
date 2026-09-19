import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ChevronDown, ChevronLeft, ChevronRight, CircleAlert, RotateCw } from "lucide-react"

import { DonutBreakdown } from "@/components/charts/DonutBreakdown"
import { Button } from "@/components/ui/button"
import { MonthButton, MonthGrid } from "@/components/ui/date-range-picker"
import { Alert, Skeleton } from "@/components/ui/states"
import { toMessage } from "@/features/companies/form-errors"
import { Panel, PanelHeading } from "@/features/dashboard/dashboard-cards"
import { formatLocalDay } from "@/features/dashboard/dashboard-format"
import type { AsyncResource } from "@/lib/hooks"
import { useAsyncResource } from "@/lib/hooks"
import { numberFormatter } from "@/lib/format"
import { addDays, addMonths, endOfMonth, startOfMonth, type LocalDate } from "@/lib/local-date"
import { cn } from "@/lib/utils"
import { getTaskCalendar, type TaskCalendarDay, type TaskSummary } from "./api"
import { statusSlices, weeklyHighlight, type HighlightSubject, type StatusSlice } from "./task-insights"

/* ─── Calendário ─────────────────────────────────────────────────────────── */

function dayDescription(day: TaskCalendarDay) {
  const open = `${numberFormatter.format(day.open)} ${day.open === 1 ? "tarefa" : "tarefas"}`
  if (day.overdue === 0) return open
  return `${open}, ${numberFormatter.format(day.overdue)} ${day.overdue === 1 ? "atrasada" : "atrasadas"}`
}

/**
 * Calendário do mês com um ponto nos dias com tarefa aberta (vermelho se houver atrasada). Clicar
 * num dia muda a data de referência — o mesmo estado do seletor do cabeçalho — e ativa a aba Hoje.
 * Navegar de mês não muda a data. Setas movem o foco, PageUp/PageDown trocam o mês, Enter escolhe.
 * Em telas menores é recolhível.
 */
export function TaskCalendar({
  referenceDate,
  owners,
  onPick,
  collapsible,
}: {
  referenceDate: LocalDate
  owners: { ownerUserId?: string; allOwners?: boolean }
  onPick: (date: LocalDate) => void
  collapsible: boolean
}) {
  const [viewMonth, setViewMonth] = useState<LocalDate>(() => startOfMonth(referenceDate))
  const [focused, setFocused] = useState<LocalDate>(referenceDate)
  const [open, setOpen] = useState(true)
  // O mês acompanha a data do cabeçalho quando ela é trocada por fora (mesmo padrão de "estado derivado").
  const [seenReference, setSeenReference] = useState(referenceDate)
  if (seenReference !== referenceDate) {
    setSeenReference(referenceDate)
    setViewMonth(startOfMonth(referenceDate))
    setFocused(referenceDate)
  }

  const gridRef = useRef<HTMLDivElement>(null)
  const headingId = useId()
  const month = viewMonth.slice(0, 7)
  const ownerKey = JSON.stringify(owners)

  const calendar = useAsyncResource((signal) => getTaskCalendar({ month, ...owners }, signal), [month, ownerKey], {
    keepPreviousData: true,
  })

  const byDate = useMemo(() => new Map((calendar.data ?? []).map((d) => [d.date, d])), [calendar.data])

  function prefetch(delta: number) {
    // Aquece o cache HTTP do vizinho; o resultado é descartado.
    void getTaskCalendar({ month: addMonths(viewMonth, delta).slice(0, 7), ...owners }).catch(() => undefined)
  }

  function moveFocus(next: LocalDate) {
    setFocused(next)
    if (next < viewMonth || next > endOfMonth(viewMonth)) setViewMonth(startOfMonth(next))
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus())
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, () => LocalDate> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => addMonths(focused, -1),
      PageDown: () => addMonths(focused, 1),
    }
    const step = steps[event.key]
    if (!step) return
    event.preventDefault()
    moveFocus(step())
  }

  const tabbable = focused >= viewMonth && focused <= endOfMonth(viewMonth) ? focused : viewMonth
  const showBody = !collapsible || open

  return (
    <Panel aria-labelledby={headingId} className="flex flex-col gap-3 p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 id={headingId} className="text-md font-medium text-fg">
          Calendário
        </h2>
        {collapsible && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${headingId}-body`}
            onClick={() => setOpen(!open)}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-sm text-fg-muted hover:bg-surface-3 hover:text-fg focus-visible:focus-ring"
          >
            <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} aria-hidden="true" />
            <span className="sr-only">{open ? "Recolher calendário" : "Mostrar calendário"}</span>
          </button>
        )}
      </header>

      {showBody && (
        <div id={`${headingId}-body`} className="flex flex-col gap-2">
          {calendar.error !== null && !calendar.data && (
            <Alert onRetry={() => calendar.reload()}>{toMessage(calendar.error, "Não foi possível carregar o calendário.")}</Alert>
          )}
          <div ref={gridRef} onKeyDown={handleKeyDown} aria-busy={calendar.isLoading} className={cn(calendar.isLoading && "opacity-70")}>
            <MonthGrid
              month={viewMonth}
              preview={{ from: referenceDate, to: referenceDate }}
              pendingStart={null}
              tabbable={tabbable}
              maxDate="9999-12-31"
              className="mx-auto w-full max-w-72"
              previous={
                <span onMouseEnter={() => prefetch(-1)}>
                  <MonthButton label="Mês anterior" onClick={() => setViewMonth(addMonths(viewMonth, -1))}>
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </MonthButton>
                </span>
              }
              next={
                <span onMouseEnter={() => prefetch(1)}>
                  <MonthButton label="Próximo mês" onClick={() => setViewMonth(addMonths(viewMonth, 1))}>
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </MonthButton>
                </span>
              }
              annotate={(date) => {
                const day = byDate.get(date)
                if (!day || day.open === 0) return null
                return { dot: day.overdue > 0 ? "overdue" : "open", description: dayDescription(day) }
              }}
              onSelect={(date) => {
                setFocused(date)
                onPick(date)
              }}
              onHover={() => undefined}
            />
          </div>
          <p className="flex items-center justify-center gap-4 text-2xs text-muted">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
              Com tarefa
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-danger" />
              Com atrasada
            </span>
          </p>
        </div>
      )}
    </Panel>
  )
}

/* ─── Estados de card ────────────────────────────────────────────────────── */

function CardBody({
  summary,
  retryLabel,
  children,
}: {
  summary: AsyncResource<TaskSummary>
  retryLabel: string
  children: (data: TaskSummary) => React.ReactNode
}) {
  if (summary.error !== null && !summary.data) {
    // O mesmo resumo alimenta os KPIs, que já anunciam a falha (role="alert"): aqui o estado é
    // visual, para o leitor de tela não ouvir o mesmo erro três vezes.
    return (
      <div className="flex flex-col items-start gap-2 text-sm text-fg-muted">
        <p className="flex items-center gap-2">
          <CircleAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />
          {retryLabel}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => summary.reload()}>
          <RotateCw aria-hidden="true" />
          Tentar de novo
        </Button>
      </div>
    )
  }
  if (!summary.data) {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-3 w-40" />
      </div>
    )
  }
  return <>{children(summary.data)}</>
}

/* ─── Tarefas por status ─────────────────────────────────────────────────── */

function StatusDetails({ slice }: { slice: StatusSlice }) {
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <p className="flex items-center gap-2 text-sm font-medium text-fg">
        <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: slice.color }} />
        {slice.label}
      </p>
      <p className="text-muted tabular">
        {numberFormatter.format(slice.value)} {slice.value === 1 ? "tarefa" : "tarefas"} · {slice.percent}%
      </p>
    </div>
  )
}

/** Donut das cinco faixas (sem canceladas); clicar leva à aba correspondente. */
export function TaskStatusCard({
  summary,
  onSelect,
  wide,
}: {
  summary: AsyncResource<TaskSummary>
  onSelect: (slice: StatusSlice) => void
  /** Na coluna lateral estreita (≥ 1536px) a legenda vai para baixo do anel. */
  wide: boolean
}) {
  const headingId = useId()
  const counts = summary.data?.counts
  const breakdown = useMemo(() => (counts ? statusSlices(counts) : null), [counts])

  return (
    <Panel aria-labelledby={headingId} className="flex flex-col gap-2 p-4">
      <PanelHeading id={headingId} title="Tarefas por status" subtitle="Abertas e concluídas nos últimos 30 dias" />
      <CardBody summary={summary} retryLabel="Não foi possível carregar o resumo.">
        {() =>
          breakdown && (
            <DonutBreakdown
              slices={breakdown.slices}
              total={breakdown.total}
              centerCaption="total"
              legendLabel="Tarefas por status"
              emptyText="Sem tarefas no período"
              sizeClassName="size-28"
              layout={wide ? "column" : "row"}
              details={(slice) => <StatusDetails slice={slice} />}
              legendValue={(slice) => (
                <>
                  {numberFormatter.format(slice.value)}
                  <span className="ml-1.5 inline-block w-9 text-right text-muted">{slice.percent}%</span>
                </>
              )}
              legendAriaLabel={(slice) =>
                `${slice.label}: ${numberFormatter.format(slice.value)} (${slice.percent}%). Ver na lista`
              }
              onSelect={onSelect}
            />
          )
        }
      </CardBody>
    </Panel>
  )
}

/* ─── Destaques da semana ────────────────────────────────────────────────── */

type SeriesPoint = { date: string; count: number; index: number }

function SeriesTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: SeriesPoint }> }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="rounded-md border border-line-strong/60 bg-surface-2/95 px-2.5 py-1.5 text-xs shadow-raised backdrop-blur-sm">
      <p className="text-muted tabular">{formatLocalDay(point.date)}</p>
      <p className="font-medium text-fg tabular">
        {numberFormatter.format(point.count)} {point.count === 1 ? "concluída" : "concluídas"}
      </p>
    </div>
  )
}

/**
 * A frase da semana e as concluídas por dia (14 dias). Segmentos lineares entre dias reais — nada de
 * curva suavizada sugerindo valor que não existe — e um divisor entre as duas semanas.
 */
export function WeeklyHighlightsCard({ summary, subject }: { summary: AsyncResource<TaskSummary>; subject: HighlightSubject }) {
  const headingId = useId()
  const gradientId = useId()

  return (
    <Panel aria-labelledby={headingId} className="flex flex-col gap-3 p-4">
      <PanelHeading id={headingId} title="Destaques da semana" subtitle="Últimos 7 dias contra os 7 anteriores" />
      <CardBody summary={summary} retryLabel="Não foi possível carregar os destaques.">
        {(data) => {
          const points: SeriesPoint[] = data.weeklyCompleted.map((p, index) => ({ ...p, index }))
          const half = points.length / 2
          return (
            <>
              <p className="text-sm text-fg" data-testid="weekly-highlight">
                {weeklyHighlight(data, subject)}
              </p>
              <figure className="flex flex-col gap-1">
                <div className="h-20" aria-hidden="true">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={points} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
                      <defs>
                        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="index" type="number" domain={[0, points.length - 1]} hide />
                      <YAxis hide domain={[0, (max: number) => Math.max(1, max)]} />
                      <ReferenceLine x={half - 0.5} stroke="var(--color-line-strong)" strokeDasharray="3 3" />
                      <Tooltip content={<SeriesTooltip />} cursor={{ stroke: "var(--color-line-strong)" }} isAnimationActive={false} />
                      <Area
                        type="linear"
                        dataKey="count"
                        stroke="var(--color-accent)"
                        strokeWidth={2}
                        fill={`url(#${gradientId})`}
                        dot={{ r: 2, fill: "var(--color-accent)", strokeWidth: 0 }}
                        activeDot={{ r: 4, stroke: "var(--color-surface)", strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <figcaption className="flex justify-between text-2xs text-muted tabular">
                  <span>Semana anterior · {numberFormatter.format(data.completedPreviousWeek)}</span>
                  <span>Últimos 7 dias · {numberFormatter.format(data.completedThisWeek)}</span>
                </figcaption>
                <table className="sr-only">
                  <caption>Tarefas concluídas por dia</caption>
                  <tbody>
                    {points.map((p) => (
                      <tr key={p.date}>
                        <th scope="row">{formatLocalDay(p.date)}</th>
                        <td>{p.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </figure>
            </>
          )
        }}
      </CardBody>
    </Panel>
  )
}
