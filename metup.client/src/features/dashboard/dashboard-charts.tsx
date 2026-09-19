import { useId, useMemo } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  useYAxisScale,
} from "recharts"

import { DonutBreakdown } from "@/components/charts/DonutBreakdown"
import type { DealSource } from "@/features/deals/api"
import { sourceLabels } from "@/features/deals/stage-labels"
import { numberFormatter } from "@/lib/format"
import type { SourceBreakdown } from "./api"
import {
  MAX_ORIGIN_SLICES,
  OTHER_SOURCES_COLOR,
  SOURCE_COLORS,
  formatLocalDay,
  formatMoneyCompact,
  formatMoneyWhole,
  formatPercent,
  smoothSeries,
} from "./dashboard-format"

const ACCENT = "var(--color-accent)"

/* ─── Sparkline dos KPIs ────────────────────────────────────────────────────── */

/** Linha de tendência do KPI: traço dourado com véu degradê — sem eixo, só a forma. */
export function Sparkline({ values }: { values: number[] }) {
  const gradientId = useId()
  const data = smoothSeries(values, 0.18).map((value, index) => ({ index, value }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area
          type="basis"
          dataKey="value"
          stroke={ACCENT}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
          dot={false}
          activeDot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ─── Evolução da receita ───────────────────────────────────────────────────── */

type RevenueDatum = { bucketStart: string; cumulative: number; revenue: number; wonDeals: number }

function RevenueTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: RevenueDatum }> }) {
  const datum = payload?.[0]?.payload
  if (!active || !datum) return null
  return (
    <div className="rounded-md border border-line-strong/60 bg-surface-2/95 px-3 py-2 shadow-raised backdrop-blur-sm">
      <p className="flex items-center gap-1.5 text-sm font-medium text-fg tabular">
        <span aria-hidden="true" className="text-accent">↑</span>
        {formatMoneyWhole(datum.cumulative)}
      </p>
      <p className="text-xs text-muted tabular">
        {formatLocalDay(datum.bucketStart)}
        {datum.wonDeals > 0 && ` · +${formatMoneyCompact(datum.revenue)} em ${numberFormatter.format(datum.wonDeals)} ${datum.wonDeals === 1 ? "ganho" : "ganhos"}`}
      </p>
    </div>
  )
}

type ActiveDotProps = { cx?: number; cy?: number; payload?: RevenueDatum }

const ACTIVE_DOT_GAP_PX = 4

/**
 * O ponto sob o cursor fica no valor real (`cumulative`), não na curva suavizada: é o mesmo número do
 * tooltip. Quando a curva passa longe do valor real, um filete liga os dois, e fica claro que a curva
 * é só tendência.
 */
function RealValueDot({ cx, cy, payload, glowId }: ActiveDotProps & { glowId: string }) {
  const yScale = useYAxisScale()
  const realY = payload && yScale ? yScale(payload.cumulative) : undefined
  if (cx == null || cy == null || realY == null) return null
  return (
    <g data-testid="revenue-active-dot" data-real-y={realY}>
      {Math.abs(realY - cy) > ACTIVE_DOT_GAP_PX && (
        <line x1={cx} x2={cx} y1={cy} y2={realY} stroke={ACCENT} strokeOpacity={0.55} strokeWidth={1} />
      )}
      <circle cx={cx} cy={realY} r={5} fill={ACCENT} stroke="var(--color-bg)" strokeWidth={2} filter={`url(#${glowId})`} />
    </g>
  )
}

/** Rótulo à direita da linha do período anterior, dentro da área do gráfico. */
function PreviousPeriodLabel({ viewBox }: { viewBox?: { x?: number; y?: number; width?: number } }) {
  if (viewBox?.x == null || viewBox.y == null || viewBox.width == null) return null
  return (
    // Contorno da cor do painel: o rótulo continua legível quando a curva passa por baixo dele.
    <text
      x={viewBox.x + viewBox.width - 4}
      y={viewBox.y - 5}
      textAnchor="end"
      fill="var(--color-muted)"
      stroke="var(--color-surface)"
      strokeWidth={3}
      paintOrder="stroke"
      fontSize={10}
    >
      Período anterior
    </text>
  )
}

/**
 * Receita acumulada no período — no B2B a receita diária é quase sempre zero; o acumulado mostra a direção.
 * `previousTotal` desenha a referência do total do período anterior; só vem quando há base de comparação.
 */
export function RevenueAreaChart({ data, previousTotal }: { data: RevenueDatum[]; previousTotal: number | null }) {
  const gradientId = useId()
  const glowId = useId()
  const plotted = useMemo(() => {
    const trend = smoothSeries(data.map((d) => d.cumulative))
    return data.map((d, i) => ({ ...d, trend: trend[i] }))
  }, [data])

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={plotted} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--color-line-soft)" strokeDasharray="0" />
        <XAxis
          dataKey="bucketStart"
          tickFormatter={formatLocalDay}
          tick={{ fill: "var(--color-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
          tickMargin={8}
        />
        <YAxis
          tickFormatter={(v: number) => (v === 0 ? "R$ 0" : formatMoneyCompact(v))}
          tick={{ fill: "var(--color-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={64}
          tickCount={5}
          domain={[0, (dataMax: number) => Math.max(dataMax, previousTotal ?? 0)]}
        />
        {previousTotal !== null && (
          <ReferenceLine
            y={previousTotal}
            stroke="var(--color-line-strong)"
            strokeDasharray="4 4"
            strokeWidth={1}
            label={PreviousPeriodLabel}
          />
        )}
        <Tooltip
          content={RevenueTooltip}
          cursor={{ stroke: ACCENT, strokeOpacity: 0.45, strokeWidth: 1 }}
          offset={16}
          allowEscapeViewBox={{ x: false, y: true }}
        />
        <Area
          type="basis"
          dataKey="trend"
          stroke={ACCENT}
          strokeWidth={2}
          strokeLinecap="round"
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={(props: ActiveDotProps) => <RealValueDot {...props} glowId={glowId} />}
          animationDuration={700}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ─── Origem (donut) ────────────────────────────────────────────────────────── */

type OriginKey = DealSource | "other"

type OriginSlice = {
  key: OriginKey
  label: string
  value: number
  wonDeals: number
  revenue: number
  color: string
  /** Só na fatia "Outras": os nomes das origens que ela soma. */
  members?: string[]
}

/**
 * Uma fatia por origem, com a cor da própria origem. Acima de {@link MAX_ORIGIN_SLICES} origens,
 * as maiores ficam e o resto soma numa fatia "Outras", que lista no tooltip o que juntou.
 */
function toOriginSlices(sources: SourceBreakdown[]): OriginSlice[] {
  const sorted = [...sources].sort((a, b) => b.newDeals - a.newDeals)
  const toSlice = (s: SourceBreakdown): OriginSlice => ({
    key: s.source,
    label: sourceLabels[s.source],
    value: s.newDeals,
    wonDeals: s.wonDeals,
    revenue: s.revenue,
    color: SOURCE_COLORS[s.source],
  })

  if (sorted.length <= MAX_ORIGIN_SLICES) return sorted.map(toSlice)

  const kept = sorted.slice(0, MAX_ORIGIN_SLICES - 1)
  const rest = sorted.slice(MAX_ORIGIN_SLICES - 1)
  return [
    ...kept.map(toSlice),
    {
      key: "other",
      label: "Outras",
      value: rest.reduce((sum, s) => sum + s.newDeals, 0),
      wonDeals: rest.reduce((sum, s) => sum + s.wonDeals, 0),
      revenue: rest.reduce((sum, s) => sum + s.revenue, 0),
      color: OTHER_SOURCES_COLOR,
      members: rest.map((s) => sourceLabels[s.source]),
    },
  ]
}

/** Tudo que a fatia representa — o mesmo conteúdo no tooltip do gráfico e no da legenda. */
function OriginDetails({ slice, total }: { slice: OriginSlice; total: number }) {
  const winRate = slice.value === 0 ? null : slice.wonDeals / slice.value
  return (
    <div className="flex flex-col gap-1 text-xs">
      <p className="flex items-center gap-2 text-sm font-medium text-fg">
        <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: slice.color }} />
        {slice.label}
      </p>
      <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 tabular">
        <dt className="text-muted">Negócios no período</dt>
        <dd className="text-right text-fg">{numberFormatter.format(slice.value)}</dd>
        <dt className="text-muted">% do total</dt>
        <dd className="text-right text-fg">{formatPercent(total === 0 ? 0 : slice.value / total)}</dd>
        <dt className="text-muted">Ganhos</dt>
        <dd className="text-right text-fg">{numberFormatter.format(slice.wonDeals)}</dd>
        <dt className="text-muted">Receita</dt>
        <dd className="text-right text-fg">{formatMoneyWhole(slice.revenue)}</dd>
        <dt className="text-muted">Taxa de ganho</dt>
        <dd className="text-right text-fg">{winRate === null ? "—" : formatPercent(winRate)}</dd>
      </dl>
      {slice.members && <p className="max-w-56 text-muted">Inclui: {slice.members.join(", ")}</p>}
    </div>
  )
}

/** Donut das origens: a fatia e a linha da legenda mostram os mesmos detalhes (negócios, ganhos, receita). */
export function OriginBreakdown({ sources }: { sources: SourceBreakdown[] }) {
  const total = sources.reduce((sum, s) => sum + s.newDeals, 0)
  // Dados estáveis entre renders: um array novo a cada hover faria o Recharts zerar o tooltip ativo.
  const slices = useMemo(() => toOriginSlices(sources), [sources])
  const share = (slice: OriginSlice) => formatPercent(total === 0 ? 0 : slice.value / total)

  return (
    <DonutBreakdown
      slices={slices}
      total={total}
      centerCaption="no período"
      legendLabel="Origens dos negócios"
      emptyText="Nenhum negócio novo."
      details={(slice) => <OriginDetails slice={slice} total={total} />}
      legendValue={share}
      legendAriaLabel={(slice) => `${slice.label}: ${share(slice)} dos negócios do período`}
    />
  )
}
