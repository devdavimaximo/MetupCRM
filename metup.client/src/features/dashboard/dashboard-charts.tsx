import { useId, useMemo } from "react"
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { numberFormatter } from "@/lib/format"
import { DONUT_COLORS, formatBucket, formatMoneyCompact, formatMoneyWhole, smoothSeries } from "./dashboard-format"

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
        {formatBucket(datum.bucketStart)}
        {datum.wonDeals > 0 && ` · +${formatMoneyCompact(datum.revenue)} em ${numberFormatter.format(datum.wonDeals)} ${datum.wonDeals === 1 ? "ganho" : "ganhos"}`}
      </p>
    </div>
  )
}

/** Receita acumulada no período — no B2B a receita diária é quase sempre zero; o acumulado mostra a direção. */
export function RevenueAreaChart({ data }: { data: RevenueDatum[] }) {
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
          tickFormatter={formatBucket}
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
        />
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
          activeDot={{ r: 5, fill: ACCENT, stroke: "var(--color-bg)", strokeWidth: 2, filter: `url(#${glowId})` }}
          animationDuration={700}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ─── Origem (donut) ────────────────────────────────────────────────────────── */

export function OriginDonut({
  slices,
  total,
  caption,
}: {
  slices: { key: string; label: string; value: number }[]
  total: number
  caption: string
}) {
  return (
    <div className="relative size-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices.length > 0 ? slices : [{ key: "empty", label: "", value: 1 }]}
            dataKey="value"
            nameKey="label"
            innerRadius="72%"
            outerRadius="100%"
            paddingAngle={slices.length > 1 ? 2 : 0}
            startAngle={90}
            endAngle={-270}
            stroke="var(--color-surface)"
            strokeWidth={2}
            isAnimationActive={slices.length > 0}
          >
            {(slices.length > 0 ? slices : [{ key: "empty" }]).map((slice, index) => (
              <Cell key={slice.key} fill={slices.length > 0 ? DONUT_COLORS[index % DONUT_COLORS.length] : "var(--color-surface-3)"} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-semibold text-fg tabular">{numberFormatter.format(total)}</span>
        <span className="text-2xs text-fg-muted">{caption}</span>
      </div>
    </div>
  )
}
