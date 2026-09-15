import type { ComponentProps, ReactNode } from "react"
import { ArrowDown, ArrowRight, ArrowUp, Ellipsis, Minus, type LucideIcon } from "lucide-react"

import { initialsOf } from "@/components/ui/monogram"
import { stageLabels, ACTIVE_STAGES } from "@/features/deals/stage-labels"
import type { DealStage } from "@/features/deals/api"
import { numberFormatter } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { FeaturedDeal, PipelineStage, StageAdvanceRate } from "./api"
import { formatInstantDay, formatMoneyCompact, formatMoneyWhole, formatPercent, type Delta } from "./dashboard-format"
import { Sparkline } from "./dashboard-charts"

/* ─── Base ──────────────────────────────────────────────────────────────────── */

/** Painel do dashboard: canto de 10px, filete discreto e um véu de luz no topo. */
export function Panel({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "relative flex min-h-0 min-w-0 flex-col rounded-lg border border-line-soft bg-linear-to-b from-surface-2/70 to-surface",
        className
      )}
      {...props}
    />
  )
}

export function PanelHeading({
  id,
  title,
  subtitle,
  aside,
  className,
}: {
  id: string
  title: string
  subtitle?: string
  aside?: ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2 xl:flex-nowrap", className)}>
      <div className="min-w-0">
        <h2 id={id} className="truncate text-md font-medium text-fg">
          {title}
        </h2>
        {subtitle && <p className="truncate text-xs text-fg-muted">{subtitle}</p>}
      </div>
      {aside}
    </header>
  )
}

export function SeeAll({ onClick, children = "Ver todas" }: { onClick: () => void; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xs text-xs text-accent transition-colors hover:text-accent-hover focus-visible:focus-ring"
    >
      {children}
      <ArrowRight className="size-3" aria-hidden="true" />
    </button>
  )
}

/** Texto e tooltip de cada caso sem percentual — o cartão explica a ausência em vez de calá-la. */
const deltaFallback = {
  new: { text: "novo", hint: "Nada no período anterior — não há percentual a calcular." },
  idle: { text: "sem movimento", hint: "Nenhum registro neste período nem no anterior." },
  "no-history": {
    text: "primeiro período com dados",
    hint: "O período anterior é anterior ao primeiro negócio — ainda não há base de comparação.",
  },
} as const

export function DeltaLine({ delta, comparison }: { delta: Delta; comparison: string }) {
  if (delta.kind !== "change") {
    const { text, hint } = deltaFallback[delta.kind]
    return (
      <p className="text-xs text-muted" title={delta.kind === "no-history" ? hint : `${hint} Comparado com ${comparison}.`}>
        {text}
      </p>
    )
  }

  const Icon = delta.direction === "up" ? ArrowUp : delta.direction === "down" ? ArrowDown : Minus
  return (
    <div className="flex flex-col whitespace-nowrap" title={`vs. ${comparison}`}>
      <span
        className={cn(
          "inline-flex items-center gap-1 text-sm font-medium tabular",
          delta.direction === "up" && "text-success",
          delta.direction === "down" && "text-danger",
          delta.direction === "flat" && "text-fg-muted"
        )}
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {delta.label}
      </span>
      <span className="text-xs text-muted">vs. <span className="max-2xl:hidden">período </span>anterior</span>
    </div>
  )
}

/* ─── KPI ───────────────────────────────────────────────────────────────────── */

export function KpiCard({
  icon: Icon,
  label,
  hint,
  value,
  delta,
  comparison,
  trend,
}: {
  icon: LucideIcon
  label: string
  /** A fórmula do número, para o tooltip — todo percentual da tela tem nome e conta. */
  hint?: string
  value: string
  delta: Delta
  comparison: string
  trend: number[]
}) {
  return (
    <Panel aria-label={label} className="min-h-fit gap-2 overflow-hidden px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-3/80 text-accent">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <p className="truncate text-sm text-fg" title={hint ? `${label} — ${hint}` : label}>{label}</p>
      </div>
      <p className="text-2xl font-semibold tracking-[-0.01em] whitespace-nowrap text-fg tabular" title={hint}>{value}</p>
      <div className="flex items-end justify-between gap-2">
        <DeltaLine delta={delta} comparison={comparison} />
        <div className="h-9 min-w-0 flex-1 max-w-28" aria-hidden="true">
          {trend.length > 1 && <Sparkline values={trend} />}
        </div>
      </div>
    </Panel>
  )
}

/* ─── Pipeline ──────────────────────────────────────────────────────────────── */

type FunnelNode = {
  key: string
  label: string
  count: number
  amount: number
  estimated: number
  /** % de quem entrou na etapa e seguiu adiante (histórico); no nó de ganhos, a taxa de fechamento. */
  percent: number | null
  percentLabel: string
  averageDays: number | null
  stalled: number
}

const CLOSE_RATE_HINT = "ganhos ÷ (ganhos + perdidos) no período"

/** Monta o tooltip do nó: tudo que o número esconde, em uma frase por linha. */
function nodeHint(node: FunnelNode, stalledAfterDays: number, isWon: boolean) {
  const lines = [
    `${numberFormatter.format(node.count)} ${isWon ? "negócios ganhos no período" : "negócios abertos nesta etapa"}`,
    `${node.amount > 0 ? formatMoneyWhole(node.amount) : "sem valor informado"}${node.estimated > 0 ? ` · ${numberFormatter.format(node.estimated)} com valor estimado pelo ticket` : ""}`,
  ]

  if (isWon) {
    lines.push(node.percent === null ? "Sem fechamentos no período." : `Taxa de fechamento: ${formatPercent(node.percent)} (${CLOSE_RATE_HINT}).`)
    return lines.join("\n")
  }

  lines.push(
    node.percent === null
      ? "Ainda sem histórico para calcular quantos avançam."
      : `${formatPercent(node.percent)} dos negócios que entraram nesta etapa avançaram para uma etapa posterior ou para Ganho.`
  )

  if (node.averageDays !== null) {
    lines.push(`Tempo médio na etapa: ${numberFormatter.format(Math.round(node.averageDays))} dias.`)
  }

  if (node.stalled > 0) {
    lines.push(`${numberFormatter.format(node.stalled)} sem mudar de etapa há mais de ${stalledAfterDays} dias.`)
  }

  return lines.join("\n")
}

/**
 * O funil como linha do tempo horizontal: nó, filete vertical, volume e a conversão histórica
 * da etapa ("x% avançam"), calculada de StageChange — não a participação da fotografia atual.
 * O último nó são os ganhos do período, com a taxa de fechamento.
 */
export function PipelineCard({
  pipeline,
  advanceRates,
  wonInPeriod,
  wonAmount,
  closeRateValue,
  stalledAfterDays,
}: {
  pipeline: PipelineStage[]
  advanceRates: StageAdvanceRate[]
  wonInPeriod: number
  wonAmount: number
  closeRateValue: number | null
  stalledAfterDays: number
}) {
  const byStage = new Map(pipeline.map((s) => [s.stage, s]))
  const advanceByStage = new Map(advanceRates.map((s) => [s.stage, s]))
  const totalOpen = pipeline.reduce((sum, s) => sum + s.count, 0)

  const nodes: FunnelNode[] = ACTIVE_STAGES.map((stage: DealStage) => {
    const data = byStage.get(stage)
    const advance = advanceByStage.get(stage)
    return {
      key: stage,
      label: stageLabels[stage],
      count: data?.count ?? 0,
      amount: data?.amount ?? 0,
      estimated: data?.estimatedCount ?? 0,
      percent: advance?.advanceRate ?? null,
      percentLabel: advance?.advanceRate == null ? "—" : `${formatPercent(advance.advanceRate)} avançam`,
      averageDays: advance?.averageDaysInStage ?? null,
      stalled: data?.stalledCount ?? 0,
    }
  })

  nodes.push({
    key: "won",
    label: "Ganhos",
    count: wonInPeriod,
    amount: wonAmount,
    estimated: 0,
    percent: closeRateValue,
    // O cabeçalho do card já nomeia a taxa; aqui só o número, para não truncar na coluna estreita.
    percentLabel: closeRateValue === null ? "—" : formatPercent(closeRateValue),
    averageDays: null,
    stalled: 0,
  })

  return (
    <Panel aria-labelledby="pipeline-heading" className="min-h-fit gap-3 px-4 py-3.5">
      <PanelHeading
        id="pipeline-heading"
        title="Pipeline Comercial"
        subtitle="Acompanhe o progresso dos seus negócios em cada etapa."
        aside={
          <dl className="flex shrink-0 divide-x divide-line-soft">
            <div className="pr-5">
              <dt className="text-xs text-muted">Negócios abertos</dt>
              <dd className="text-md font-medium text-fg tabular">{numberFormatter.format(totalOpen)}</dd>
            </div>
            <div className="pl-5" title={`Taxa de fechamento — ${CLOSE_RATE_HINT}`}>
              <dt className="text-xs text-muted">Taxa de fechamento</dt>
              <dd className="text-md font-medium text-fg tabular">
                {closeRateValue === null ? "—" : formatPercent(closeRateValue)}
              </dd>
            </div>
          </dl>
        }
      />

      <ol className="grid grid-cols-2 gap-y-5 border-t border-line-soft pt-3 sm:grid-cols-4 xl:grid-cols-8">
        {nodes.map((node) => {
          const isWon = node.key === "won"
          return (
            <li key={node.key} className="relative flex min-w-0 gap-2.5 pr-2" title={nodeHint(node, stalledAfterDays, isWon)}>
              <div className="flex flex-col items-center pt-0.5" aria-hidden="true">
                <span
                  className={cn(
                    "size-3 shrink-0 rounded-full border-2",
                    node.count > 0 ? "border-accent" : "border-line-strong",
                    isWon && node.count > 0 && "bg-accent"
                  )}
                />
                <span className="mt-1 w-px flex-1 bg-line-strong/60" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate text-xs text-fg-muted">{node.label}</p>
                <div className="flex items-center gap-2">
                  <p className={cn("text-xl font-semibold text-fg tabular", node.count === 0 && "text-faint")}>
                    {numberFormatter.format(node.count)}
                  </p>
                  {!isWon && (
                    <span aria-hidden="true" className="relative hidden h-px flex-1 bg-accent/70 min-[1700px]:block">
                      <span className="absolute -top-0.5 right-0 size-1.5 rounded-full bg-accent" />
                    </span>
                  )}
                  {node.stalled > 0 && (
                    <span className="text-2xs text-danger tabular">
                      <span className="sr-only">parados: </span>●{node.stalled}
                    </span>
                  )}
                </div>
                <p className="truncate text-2xs text-muted tabular">{node.percentLabel}</p>
                {/* "~" marca a etapa cujo dinheiro vem (em parte) do ticket — o tooltip diz quantos. */}
                <p className="truncate text-2xs text-fg-muted tabular">
                  {node.amount > 0 ? `${node.estimated > 0 ? "~" : ""}${formatMoneyCompact(node.amount)}` : "R$ —"}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

/* ─── Negócios em destaque ──────────────────────────────────────────────────── */

const stageTone: Record<DealStage, string> = {
  Prospect: "bg-surface-3 text-fg-muted",
  PrimeiroContato: "bg-surface-3 text-fg-muted",
  ContatoRealizado: "bg-surface-3 text-fg-muted",
  Qualificacao: "bg-success/12 text-success",
  Reuniao: "bg-success/12 text-success",
  Proposta: "bg-accent/12 text-accent",
  Negociacao: "bg-accent/15 text-accent",
  Ganho: "bg-success/15 text-success",
  Perdido: "bg-danger/12 text-danger",
}

export function FeaturedDealsCard({ deals, onOpenDeal }: { deals: FeaturedDeal[]; onOpenDeal: (dealId: string) => void }) {
  return (
    <Panel aria-labelledby="featured-heading" className="gap-2 px-4 pt-4 pb-2">
      <PanelHeading id="featured-heading" title="Negócios em Destaque" />
      {deals.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-muted">
          Nenhum negócio aberto com valor ou ticket informado.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-120 text-left text-sm">
            <thead>
              <tr className="text-2xs text-muted">
                <th scope="col" className="pb-2 font-normal">Empresa</th>
                <th scope="col" className="pb-2 font-normal">Valor</th>
                <th scope="col" className="pb-2 font-normal">Etapa</th>
                <th scope="col" className="pb-2 font-normal">Responsável</th>
                <th scope="col" className="pb-2 font-normal">Ação</th>
                <th scope="col" className="w-8 pb-2 max-[1699px]:hidden"><span className="sr-only">Abrir</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft/70 border-t border-line-soft/70">
              {deals.map((deal) => (
                <tr key={deal.id} className="group transition-colors hover:bg-surface-3/40">
                  <td className="py-1 pr-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm border border-line-soft bg-surface-3 font-mono text-[0.5625rem] text-fg-muted"
                      >
                        {initialsOf(deal.companyName)}
                      </span>
                      <button type="button" onClick={() => onOpenDeal(deal.id)} className="max-w-40 cursor-pointer truncate rounded-xs text-left text-fg hover:underline focus-visible:focus-ring">{deal.companyName}</button>
                    </span>
                  </td>
                  <td className="py-1 pr-3 whitespace-nowrap text-fg tabular">
                    {deal.amount === null ? (
                      "—"
                    ) : (
                      <>
                        {formatMoneyWhole(deal.amount)}
                        {deal.isEstimated && (
                          <span
                            className="ml-1 text-2xs text-muted"
                            title="Valor estimado pelo ticket — o negócio ainda não tem valor em negociação."
                          >
                            est.
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="py-1 pr-3">
                    <span className={cn("inline-flex rounded-sm px-2 py-0.5 text-2xs whitespace-nowrap", stageTone[deal.stage])}>
                      {stageLabels[deal.stage]}
                    </span>
                  </td>
                  <td className="py-1 pr-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[0.5625rem] font-medium text-fg-muted ring-1 ring-line-strong/50"
                      >
                        {initialsOf(deal.ownerUserName)}
                      </span>
                      <span className="max-w-32 truncate text-fg-muted" title={deal.ownerUserName}>
                        {deal.ownerUserName.split(/\s+/)[0]}
                      </span>
                    </span>
                  </td>
                  <td
                    className={cn(
                      "py-2 pr-3 whitespace-nowrap tabular",
                      !deal.nextTaskDueDate ? "text-danger" : new Date(deal.nextTaskDueDate) < new Date() ? "text-danger" : "text-fg-muted"
                    )}
                  >
                    {deal.nextTaskDueDate ? formatInstantDay(deal.nextTaskDueDate) : "Sem ação"}
                  </td>
                  <td className="py-1 text-right max-[1699px]:hidden">
                    <button
                      type="button"
                      onClick={() => onOpenDeal(deal.id)}
                      aria-label={`Abrir negócio de ${deal.companyName}`}
                      className="inline-flex size-7 cursor-pointer items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-3 hover:text-fg focus-visible:focus-ring"
                    >
                      <Ellipsis className="size-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

/* ─── Cartão Metup (potencial) ──────────────────────────────────────────────── */

/** Assinatura visual da marca: linhas de "arquitetura" em dourado, com dados reais do potencial. */
export function PotentialCard({
  openAmount,
  forecast,
  closingAmount,
  onOpenPipeline,
}: {
  openAmount: number
  forecast: number | null
  closingAmount: number
  onOpenPipeline: () => void
}) {
  return (
    <Panel aria-labelledby="potential-heading" className="overflow-hidden bg-surface p-5">
      <svg aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 h-full w-3/5" preserveAspectRatio="none" viewBox="0 0 300 240">
        <defs>
          <linearGradient id="metup-fade" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--color-surface)" stopOpacity="1" />
            <stop offset="55%" stopColor="var(--color-surface)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="metup-beam" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--color-accent)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`v${i}`} x1={60 + i * 30} x2={60 + i * 30} y1={0} y2={240} stroke="var(--color-line-soft)" strokeWidth={1} />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <line key={`h${i}`} x1={60} x2={300} y1={i * 22} y2={i * 22 + 8} stroke="var(--color-line)" strokeWidth={1} />
        ))}
        <rect x={208} y={0} width={3} height={240} fill="url(#metup-beam)" />
        <rect x={238} y={20} width={2} height={200} fill="url(#metup-beam)" opacity={0.6} />
        <rect x={0} y={0} width={300} height={240} fill="url(#metup-fade)" />
      </svg>

      <div className="relative flex h-full max-w-[68%] flex-col justify-center gap-2.5">
        <p className="label-mono text-accent">Metup CRM</p>
        <h2 id="potential-heading" className="text-md leading-snug font-medium text-fg min-[1700px]:text-lg">
          {formatMoneyCompact(openAmount)} em aberto,{" "}
          <span className="text-fg-muted">
            {forecast === null ? "pipeline para destravar." : `${formatMoneyCompact(forecast)} previstos.`}
          </span>
        </h2>
        <p className="line-clamp-2 text-xs text-fg-muted">
          {closingAmount > 0
            ? `${formatMoneyWhole(closingAmount)} já estão em proposta ou negociação. Mantenha a próxima ação de cada um em dia.`
            : "Avance os negócios qualificados para proposta e transforme o pipeline em receita."}
        </p>
        <button
          type="button"
          onClick={onOpenPipeline}
          className="mt-1 inline-flex w-fit cursor-pointer items-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-medium text-on-accent transition-colors hover:bg-accent-hover focus-visible:focus-ring"
        >
          Abrir pipeline
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </Panel>
  )
}
