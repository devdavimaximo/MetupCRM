import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Panel, PanelHeading } from "@/components/metrics/panel"
import { SegmentedControl } from "@/components/ui/segmented"
import { Alert, Skeleton } from "@/components/ui/states"
import { Hint } from "@/components/ui/tooltip"
import type { PipelineEvolution } from "./api"
import { formatMoneyCompact, formatMoneyWhole } from "./pipeline-metrics"
import { EVOLUTION_MONTHS, evolutionMonthsLabel, type EvolutionMonths } from "./pipeline-url"

/**
 * As duas séries. Os tons foram validados contra a superfície escura do app (banda de luminância,
 * piso de croma, separação para daltonismo e contraste) — por isso o dourado aqui é um passo mais
 * fechado que o `--color-accent` da interface, que fica fora da banda do modo escuro.
 */
const SERIES = [
  { key: "pipelineTotal", label: "Pipeline total", color: "#c07c10" },
  { key: "forecastRevenue", label: "Receita prevista", color: "#2f7fb8" },
] as const

const monthNames = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })

/** "2026-06" → "junho de 2026" (tooltip) e "jun" (eixo). */
function monthLabels(month: string) {
  const [year, index] = month.split("-").map(Number)
  const date = new Date(year, index - 1, 1)
  const full = monthNames.format(date)
  return { full, short: full.slice(0, 3) }
}

type Point = { month: string; axis: string; full: string; isPartial: boolean; pipelineTotal: number; forecastRevenue: number | null }

function EvolutionTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: Point }> }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  return (
    <div className="rounded-md border border-line-strong/60 bg-surface-2/95 px-3 py-2 shadow-raised backdrop-blur-sm">
      <p className="text-xs text-fg-muted">
        {point.full}
        {point.isPartial && " (mês em curso)"}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {SERIES.map((series) => {
          const value = point[series.key]
          return (
            <li key={series.key} className="flex items-center gap-2 text-sm text-fg">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: series.color }} />
              <span className="text-fg-muted">{series.label}</span>
              {/* O tooltip mostra o valor exato, nunca o compacto do eixo. */}
              <span className="ml-auto tabular">{value === null ? "—" : formatMoneyWhole(value)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Evolução do pipeline (item 18): pipeline total e receita prevista no fim de cada mês. Linha reta
 * entre pontos — sem curva suavizada, que inventaria valores entre meses que não existem. As duas
 * séries são reais em R$, então dividem o mesmo eixo.
 */
export function PipelineEvolutionChart({
  evolution,
  isLoading,
  error,
  months,
  onMonths,
  onRetry,
}: {
  evolution: PipelineEvolution | null
  isLoading: boolean
  error: string | null
  months: EvolutionMonths
  onMonths: (months: EvolutionMonths) => void
  onRetry: () => void
}) {
  const data: Point[] = (evolution?.points ?? []).map((point) => {
    const labels = monthLabels(point.month)
    return {
      month: point.month,
      axis: labels.short,
      full: labels.full,
      isPartial: point.isPartial,
      pipelineTotal: point.pipelineTotal,
      forecastRevenue: point.forecastRevenue,
    }
  })

  return (
    <Panel aria-labelledby="evolution-heading" className="min-h-fit gap-3 px-4 py-3.5">
      <PanelHeading
        id="evolution-heading"
        title="Evolução do Pipeline"
        aside={
          <SegmentedControl
            label="Janela da evolução"
            value={String(months)}
            options={EVOLUTION_MONTHS.map((value) => ({ value: String(value), label: evolutionMonthsLabel(value) }))}
            onChange={(value) => onMonths(Number(value) as EvolutionMonths)}
          />
        }
      />

      {error && !evolution ? (
        <Alert onRetry={onRetry}>{error}</Alert>
      ) : !evolution ? (
        <div role="status" aria-busy={isLoading}>
          <span className="sr-only">Carregando a evolução do pipeline…</span>
          <Skeleton className="h-56 w-full" />
        </div>
      ) : (
        <>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--color-line-soft)" vertical={false} />
                <XAxis
                  dataKey="axis"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                  minTickGap={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                  tickFormatter={(value: number) => formatMoneyCompact(value)}
                />
                <Tooltip content={<EvolutionTooltip />} cursor={{ stroke: "var(--color-line-strong)" }} />
                <Legend
                  verticalAlign="bottom"
                  height={24}
                  formatter={(value) => <span className="text-xs text-fg-muted">{value}</span>}
                />
                {SERIES.map((series) => (
                  <Line
                    key={series.key}
                    type="linear"
                    name={series.label}
                    dataKey={series.key}
                    stroke={series.color}
                    strokeWidth={2}
                    dot={{ r: 3, fill: series.color, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela equivalente: os mesmos números em texto, para quem não lê o desenho. */}
          <table className="sr-only">
            <caption>Pipeline total e receita prevista no fim de cada mês</caption>
            <thead>
              <tr>
                <th scope="col">Mês</th>
                {SERIES.map((series) => (
                  <th key={series.key} scope="col">
                    {series.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.month}>
                  <th scope="row">{point.full}</th>
                  {SERIES.map((series) => (
                    <td key={series.key}>{point[series.key] === null ? "sem histórico" : formatMoneyWhole(point[series.key]!)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <Hint content="Só guardamos o histórico de valor a partir da migration da PL1. Em meses anteriores a ela, o negócio aparece com o valor seguinte conhecido — a curva ali é aproximada.">
            <p tabIndex={0} className="w-fit rounded-xs text-2xs text-faint focus-visible:focus-ring">
              Meses anteriores ao histórico de valor usam aproximação.
            </p>
          </Hint>
        </>
      )}
    </Panel>
  )
}
