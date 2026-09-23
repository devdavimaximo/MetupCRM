import type { ReactNode } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { stageLabels } from "@/features/deals/stage-labels"
import { formatMoneyCompact, formatMoneyWhole } from "@/features/dashboard/dashboard-format"
import { numberFormatter, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { CohortGroup, DurationBucket, ForecastByStage, ForecastMonth, FunnelStep, SalesPerformanceGroup } from "./api"
import { formatDays, formatPercent, formatPrecisePercent } from "./report-ui"

/**
 * As cores dos relatórios. Dourado é o resultado (receita, o que avançou); os cinzas são o
 * contexto; verde e vermelho só aparecem onde significam ganho e perda de verdade — a mesma
 * disciplina de cor do dashboard, para a tela não virar arco-íris.
 */
const ACCENT = "var(--color-accent)"
const NEUTRAL = "var(--color-surface-3)"
const MUTED = "var(--color-muted)"
const SUCCESS = "var(--color-success)"
const DANGER = "var(--color-danger)"

const AXIS_TICK = { fill: "var(--color-muted)", fontSize: 11 }
const GRID_STROKE = "var(--color-line-soft)"

/** A moldura de todo tooltip de gráfico da tela — a mesma do dashboard. */
function TooltipCard({ title, accent, children }: { title: string; accent?: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-line-strong/60 bg-surface-2/95 px-3 py-2 shadow-raised backdrop-blur-sm">
      <p className="flex items-center gap-2 text-sm font-medium text-fg">
        {accent && <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: accent }} />}
        {title}
      </p>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-xs tabular">{children}</dl>
    </div>
  )
}

function TooltipRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-fg">{value}</dd>
    </>
  )
}

/* ─── Funil em coorte ───────────────────────────────────────────────────────── */

/**
 * O funil do período, etapa a etapa. Não é um gráfico de barras do estágio atual: cada linha é
 * quantos negócios da coorte <b>alcançaram</b> aquela etapa, então a escada só desce — e o degrau
 * entre duas linhas é exatamente onde o funil trava.
 *
 * A queda entre etapas é marcada explicitamente: é a informação que o SDR procura, e deixá-la
 * implícita na diferença de largura das barras seria esconder o que a tela existe para mostrar.
 */
export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const top = steps[0]?.reached ?? 0

  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => {
        const width = top === 0 ? 0 : Math.max(step.reached === 0 ? 0 : 1.5, (step.reached / top) * 100)
        const previous = index === 0 ? null : steps[index - 1]
        const dropped = previous ? previous.reached - step.reached : 0
        const isWon = step.stage === "Ganho"

        return (
          <li key={step.stage} className="flex flex-col">
            {previous && (
              <div className="flex items-center gap-2 py-1 pl-[1.9rem] text-2xs text-faint">
                <span aria-hidden="true" className="h-3 w-px bg-line-soft" />
                <span className={cn("tabular", dropped > 0 && "text-muted")}>
                  {dropped > 0
                    ? `${formatPrecisePercent(step.stepRate)} passaram · ${pluralize(dropped, "ficou pelo caminho", "ficaram pelo caminho")}`
                    : "todos passaram"}
                </span>
              </div>
            )}

            <div
              className="grid grid-cols-[1.5rem_minmax(0,8rem)_minmax(0,1fr)_3.5rem] items-center gap-x-3 rounded-sm px-1 py-1.5 sm:grid-cols-[1.5rem_10rem_minmax(0,1fr)_4rem_5rem_5.5rem]"
            >
              <span className="font-mono text-2xs text-faint tabular">{String(index + 1).padStart(2, "0")}</span>
              <span className={cn("truncate text-base", step.reached === 0 ? "text-faint" : "text-fg")}>
                {stageLabels[step.stage]}
              </span>
              <span className="h-2.5 bg-surface-3/60" aria-hidden="true">
                <span
                  className="block h-full transition-[width] duration-500 ease-out"
                  style={{
                    width: `${width}%`,
                    background: isWon ? SUCCESS : ACCENT,
                    opacity: isWon ? 1 : 1 - index * 0.07,
                  }}
                />
              </span>
              <span className={cn("text-right text-base font-medium tabular", step.reached === 0 ? "text-faint" : "text-fg")}>
                {numberFormatter.format(step.reached)}
                <span className="sr-only"> negócios alcançaram {stageLabels[step.stage]}</span>
              </span>
              <span className="hidden text-right text-sm text-muted tabular sm:block" title="Conversão desde o topo do funil">
                {formatPercent(step.topRate)}
              </span>
              <span className="hidden text-right text-sm text-muted tabular sm:block" title="Tempo médio parado nesta etapa">
                {step.averageDays === null ? <span className="text-faint">—</span> : formatDays(step.averageDays)}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/* ─── Desempenho por grupo ──────────────────────────────────────────────────── */

type GroupDatum = {
  label: string
  revenue: number
  previousRevenue: number
  closeRate: number | null
  wonDeals: number
  lostDeals: number
  openDeals: number
}

function GroupTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: GroupDatum }> }) {
  const datum = payload?.[0]?.payload
  if (!active || !datum) return null

  return (
    <TooltipCard title={datum.label} accent={ACCENT}>
      <TooltipRow label="Receita fechada" value={formatMoneyWhole(datum.revenue)} />
      <TooltipRow label="Período anterior" value={formatMoneyWhole(datum.previousRevenue)} />
      <TooltipRow label="Ganhos" value={numberFormatter.format(datum.wonDeals)} />
      <TooltipRow label="Perdidos" value={numberFormatter.format(datum.lostDeals)} />
      <TooltipRow label="Em aberto" value={numberFormatter.format(datum.openDeals)} />
      <TooltipRow label="Fechamento" value={formatPercent(datum.closeRate)} />
    </TooltipCard>
  )
}

/**
 * Receita fechada por grupo (barra) com a taxa de fechamento por cima (linha): volume e eficiência
 * na mesma leitura — quem vende muito fechando pouco e quem fecha muito vendendo pouco aparecem
 * como formas diferentes, não como duas tabelas separadas.
 */
export function GroupPerformanceChart({ groups }: { groups: SalesPerformanceGroup[] }) {
  const data: GroupDatum[] = groups.map((group) => ({
    label: group.groupLabel,
    revenue: group.totalRevenue,
    previousRevenue: group.previousRevenue,
    closeRate: group.closeRate,
    wonDeals: group.wonDeals,
    lostDeals: group.lostDeals,
    openDeals: group.openDeals,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} interval={0} height={36} />
        <YAxis
          yAxisId="revenue"
          tickFormatter={(v: number) => (v === 0 ? "R$ 0" : formatMoneyCompact(v))}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={64}
          tickCount={5}
        />
        <YAxis
          yAxisId="rate"
          orientation="right"
          domain={[0, 1]}
          tickFormatter={(v: number) => formatPercent(v)}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={44}
          tickCount={3}
        />
        <Tooltip content={GroupTooltip} cursor={{ fill: "var(--color-surface-2)", fillOpacity: 0.6 }} offset={16} />
        <Bar yAxisId="revenue" dataKey="revenue" fill={ACCENT} radius={[2, 2, 0, 0]} maxBarSize={56} animationDuration={600} />
        <Line
          yAxisId="rate"
          type="monotone"
          dataKey="closeRate"
          stroke={MUTED}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={{ r: 2.5, fill: MUTED, strokeWidth: 0 }}
          // Grupo sem negócio fechado não tem taxa: a linha se interrompe em vez de cair a zero.
          connectNulls={false}
          animationDuration={600}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/* ─── Tempo até fechar ──────────────────────────────────────────────────────── */

export function bucketLabel(bucket: DurationBucket, index: number, buckets: DurationBucket[]): string {
  if (bucket.upToDays === null) return `+${buckets[index - 1]?.upToDays ?? 0}d`
  const previous = index === 0 ? 0 : (buckets[index - 1].upToDays ?? 0) + 1
  return `${previous}–${bucket.upToDays}d`
}

/**
 * Distribuição do tempo até fechar. A média sozinha esconde a cauda: dois negócios de 200 dias
 * puxam a média de uma operação que normalmente fecha em duas semanas — o histograma mostra os
 * dois fatos ao mesmo tempo.
 */
export function TimeToCloseHistogram({ distribution, average }: { distribution: DurationBucket[]; average: number | null }) {
  const data = distribution.map((bucket, index) => ({
    label: bucketLabel(bucket, index, distribution),
    count: bucket.count,
    upToDays: bucket.upToDays,
  }))

  // A referência da média é desenhada na faixa em que ela cai, não num eixo contínuo de dias.
  const averageIndex =
    average === null ? -1 : distribution.findIndex((b) => b.upToDays === null || average <= b.upToDays)

  return (
    // Os números deste gráfico não aparecem em nenhuma tabela da tela: a versão em texto é a
    // única leitura possível para quem usa leitor de tela.
    <>
      <ul className="sr-only">
        {data.map((bucket) => (
          <li key={bucket.label}>
            {bucket.label}: {pluralize(bucket.count, "negócio", "negócios")}
          </li>
        ))}
      </ul>
      <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} interval={0} />
        <YAxis
          tickFormatter={(v: number) => numberFormatter.format(v)}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={36}
          allowDecimals={false}
          tickCount={4}
        />
        <Tooltip
          cursor={{ fill: "var(--color-surface-2)", fillOpacity: 0.6 }}
          offset={16}
          content={({ active, payload }) => {
            const datum = payload?.[0]?.payload as { label: string; count: number } | undefined
            if (!active || !datum) return null
            return (
              <TooltipCard title={`Fechados em ${datum.label}`} accent={ACCENT}>
                <TooltipRow label="Negócios" value={numberFormatter.format(datum.count)} />
              </TooltipCard>
            )
          }}
        />
        {averageIndex >= 0 && (
          <ReferenceLine
            x={data[averageIndex]?.label}
            stroke="var(--color-line-strong)"
            strokeDasharray="4 4"
            label={{ value: "média", position: "top", fill: MUTED, fontSize: 10 }}
          />
        )}
          <Bar dataKey="count" fill={ACCENT} radius={[2, 2, 0, 0]} maxBarSize={72} animationDuration={600} />
        </BarChart>
      </ResponsiveContainer>
    </>
  )
}

/* ─── Forecast ──────────────────────────────────────────────────────────────── */

/**
 * Por estágio, quanto está em aberto e quanto disso o histórico sustenta. A barra cheia é o valor
 * bruto; a parte dourada, o ponderado — a distância entre as duas é, visualmente, o risco.
 * Estágio sem probabilidade histórica aparece inteiro em cinza: não é forecast zero, é forecast
 * desconhecido.
 */
export function ForecastWaterfall({ byStage }: { byStage: ForecastByStage[] }) {
  const data = byStage.map((row) => ({
    label: stageLabels[row.stage],
    weighted: row.weightedAmount ?? 0,
    rest: row.openAmount - (row.weightedAmount ?? 0),
    openAmount: row.openAmount,
    count: row.openDealsCount,
    probability: row.winProbability,
    hasProbability: row.winProbability !== null,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} interval={0} height={36} />
        <YAxis
          tickFormatter={(v: number) => (v === 0 ? "R$ 0" : formatMoneyCompact(v))}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={64}
          tickCount={5}
        />
        <Tooltip
          cursor={{ fill: "var(--color-surface-2)", fillOpacity: 0.6 }}
          offset={16}
          content={({ active, payload }) => {
            const datum = payload?.[0]?.payload as (typeof data)[number] | undefined
            if (!active || !datum) return null
            return (
              <TooltipCard title={datum.label} accent={ACCENT}>
                <TooltipRow label="Em aberto" value={formatMoneyWhole(datum.openAmount)} />
                <TooltipRow label="Negócios" value={numberFormatter.format(datum.count)} />
                <TooltipRow label="Prob. histórica" value={formatPercent(datum.probability)} />
                <TooltipRow
                  label="Ponderado"
                  value={datum.hasProbability ? formatMoneyWhole(datum.weighted) : "sem histórico"}
                />
              </TooltipCard>
            )
          }}
        />
        <Bar dataKey="weighted" stackId="pipeline" fill={ACCENT} maxBarSize={56} animationDuration={600} />
        <Bar dataKey="rest" stackId="pipeline" radius={[2, 2, 0, 0]} maxBarSize={56} animationDuration={600}>
          {data.map((datum) => (
            <Cell key={datum.label} fill={NEUTRAL} fillOpacity={datum.hasProbability ? 0.8 : 0.5} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" })

/** "Set 26" a partir de "2026-09"; o balde sem previsão tem nome próprio. */
export function formatMonthKey(monthKey: string | null): string {
  if (monthKey === null) return "Sem previsão"
  const [year, month] = monthKey.split("-").map(Number)
  const label = monthFormatter.format(new Date(year, month - 1, 1)).replace(".", "")
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * Quanto o pipeline promete por mês, pela previsão que o responsável informou. O mês vencido com
 * negócio ainda aberto sai em vermelho: é previsão furada, não receita futura.
 */
export function ForecastOutlookChart({ byMonth }: { byMonth: ForecastMonth[] }) {
  const data = byMonth.map((month) => ({
    label: formatMonthKey(month.monthKey),
    openAmount: month.openAmount,
    weighted: month.weightedAmount,
    count: month.openDealsCount,
    isOverdue: month.isOverdue,
    isUnknown: month.monthKey === null,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} interval={0} height={36} />
        <YAxis
          tickFormatter={(v: number) => (v === 0 ? "R$ 0" : formatMoneyCompact(v))}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={64}
          tickCount={5}
        />
        <Tooltip
          cursor={{ fill: "var(--color-surface-2)", fillOpacity: 0.6 }}
          offset={16}
          content={({ active, payload }) => {
            const datum = payload?.[0]?.payload as (typeof data)[number] | undefined
            if (!active || !datum) return null
            return (
              <TooltipCard title={datum.label} accent={datum.isOverdue ? DANGER : ACCENT}>
                <TooltipRow label="Em aberto" value={formatMoneyWhole(datum.openAmount)} />
                <TooltipRow label="Negócios" value={numberFormatter.format(datum.count)} />
                <TooltipRow label="Ponderado" value={datum.weighted === null ? "—" : formatMoneyWhole(datum.weighted)} />
                {datum.isOverdue && <TooltipRow label="Atenção" value="previsão vencida" />}
                {datum.isUnknown && <TooltipRow label="Atenção" value="sem data prevista" />}
              </TooltipCard>
            )
          }}
        />
        <Bar dataKey="openAmount" radius={[2, 2, 0, 0]} maxBarSize={56} animationDuration={600}>
          {data.map((datum) => (
            <Cell
              key={datum.label}
              fill={datum.isOverdue ? DANGER : datum.isUnknown ? NEUTRAL : ACCENT}
              fillOpacity={datum.isUnknown ? 0.7 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ─── Safras ────────────────────────────────────────────────────────────────── */

const cohortMonthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" })

export function formatCohortLabel(cohortKey: string): string {
  const label = cohortMonthFormatter.format(new Date(`${cohortKey}-01T00:00:00`)).replace(".", "")
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * Cada safra em barras empilhadas (ganhos, perdidos, ainda abertos) com a taxa de fechamento por
 * cima. Safra recente tem muita coisa em aberto e taxa instável — empilhar deixa isso explícito,
 * em vez de deixar a taxa de uma safra de três semanas parecer comparável à de um ano atrás.
 */
export function CohortTrendChart({ cohorts }: { cohorts: CohortGroup[] }) {
  const data = cohorts.map((cohort) => ({
    label: formatCohortLabel(cohort.cohortKey),
    won: cohort.wonDeals,
    lost: cohort.lostDeals,
    open: cohort.openDeals,
    total: cohort.totalDeals,
    closeRate: cohort.closeRate,
    revenue: cohort.totalRevenue,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} interval={0} height={36} />
        <YAxis
          yAxisId="count"
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={36}
          allowDecimals={false}
          tickCount={4}
        />
        <YAxis
          yAxisId="rate"
          orientation="right"
          domain={[0, 1]}
          tickFormatter={(v: number) => formatPercent(v)}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={44}
          tickCount={3}
        />
        <Tooltip
          cursor={{ fill: "var(--color-surface-2)", fillOpacity: 0.6 }}
          offset={16}
          content={({ active, payload }) => {
            const datum = payload?.[0]?.payload as (typeof data)[number] | undefined
            if (!active || !datum) return null
            return (
              <TooltipCard title={datum.label}>
                <TooltipRow label="Negócios" value={numberFormatter.format(datum.total)} />
                <TooltipRow label="Ganhos" value={numberFormatter.format(datum.won)} />
                <TooltipRow label="Perdidos" value={numberFormatter.format(datum.lost)} />
                <TooltipRow label="Em aberto" value={numberFormatter.format(datum.open)} />
                <TooltipRow label="Fechamento" value={formatPercent(datum.closeRate)} />
                <TooltipRow label="Receita" value={formatMoneyWhole(datum.revenue)} />
              </TooltipCard>
            )
          }}
        />
        <Bar yAxisId="count" dataKey="won" stackId="cohort" fill={SUCCESS} maxBarSize={48} animationDuration={600} />
        <Bar yAxisId="count" dataKey="lost" stackId="cohort" fill={DANGER} fillOpacity={0.75} maxBarSize={48} animationDuration={600} />
        <Bar
          yAxisId="count"
          dataKey="open"
          stackId="cohort"
          fill={NEUTRAL}
          radius={[2, 2, 0, 0]}
          maxBarSize={48}
          animationDuration={600}
        />
        <Line
          yAxisId="rate"
          type="monotone"
          dataKey="closeRate"
          stroke={ACCENT}
          strokeWidth={1.5}
          dot={{ r: 2.5, fill: ACCENT, strokeWidth: 0 }}
          connectNulls={false}
          animationDuration={600}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/**
 * Cada safra como uma célula tingida pela taxa de fechamento — a leitura de um olhar só, para
 * responder "as safras recentes estão convertendo melhor ou pior que as antigas?". Safra sem
 * negócio fechado fica vazada: não tem taxa, e pintar de escuro a faria parecer ruim.
 */
export function CohortHeatmap({ cohorts }: { cohorts: CohortGroup[] }) {
  return (
    <div className="flex flex-col gap-2">
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5">
        {cohorts.map((cohort) => {
          const rate = cohort.closeRate
          return (
            <li
              key={cohort.cohortKey}
              title={`${formatCohortLabel(cohort.cohortKey)} · ${pluralize(cohort.totalDeals, "negócio", "negócios")} · ${formatPercent(rate)} de fechamento`}
              className={cn(
                "flex flex-col gap-0.5 rounded-sm border px-2 py-1.5",
                rate === null ? "border-dashed border-line-soft" : "border-transparent"
              )}
              style={
                rate === null
                  ? undefined
                  : {
                      // A opacidade cresce com a taxa: o dourado forte é a safra que converteu.
                      background: `color-mix(in oklab, var(--color-accent) ${Math.round(12 + rate * 70)}%, transparent)`,
                    }
              }
            >
              <span className="truncate text-2xs text-muted">{formatCohortLabel(cohort.cohortKey)}</span>
              <span className={cn("text-sm font-medium tabular", rate === null ? "text-faint" : "text-fg")}>
                {formatPercent(rate)}
              </span>
              <span className="text-2xs text-muted tabular">{numberFormatter.format(cohort.totalDeals)} neg.</span>
            </li>
          )
        })}
      </ol>
      <div className="flex items-center gap-2 text-2xs text-faint">
        <span>0%</span>
        <span
          aria-hidden="true"
          className="h-1.5 flex-1 rounded-full"
          style={{ background: "linear-gradient(90deg, color-mix(in oklab, var(--color-accent) 12%, transparent), var(--color-accent))" }}
        />
        <span>100% de fechamento</span>
      </div>
    </div>
  )
}
