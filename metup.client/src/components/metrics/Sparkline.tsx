import { useId } from "react"
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts"

import { smoothSeries } from "./series"

const ACCENT = "var(--color-accent)"

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
