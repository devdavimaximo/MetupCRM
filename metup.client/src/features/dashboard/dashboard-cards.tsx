import { useRef, useState, type ComponentProps, type ReactNode, type Ref } from "react"
import { ArrowDown, ArrowRight, ArrowUp, Building2, Ellipsis, Info, Minus, SquareArrowOutUpRight, type LucideIcon } from "lucide-react"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { initialsOf } from "@/components/ui/monogram"
import { Hint } from "@/components/ui/tooltip"
import { stageLabels, ACTIVE_STAGES } from "@/features/deals/stage-labels"
import type { DealStage } from "@/features/deals/api"
import { numberFormatter } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ExpectedClose, FeaturedDeal, PipelineStage, StageAdvanceRate } from "./api"
import { daysInclusive } from "@/lib/local-date"
import { formatInstantDay, formatLocalDay, formatMoneyCompact, formatMoneyWhole, formatPercent, type Delta } from "./dashboard-format"
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

export function SeeAll({
  onClick,
  children = "Ver todas",
  ref,
}: {
  onClick: () => void
  children?: ReactNode
  ref?: Ref<HTMLButtonElement>
}) {
  return (
    <button
      ref={ref}
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
      <Hint content={delta.kind === "no-history" ? hint : `${hint} Comparado com ${comparison}.`}>
        <p className="text-xs text-muted">{text}</p>
      </Hint>
    )
  }

  const Icon = delta.direction === "up" ? ArrowUp : delta.direction === "down" ? ArrowDown : Minus
  return (
    <Hint content={`vs. ${comparison}`}>
      <div className="flex flex-col whitespace-nowrap">
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
        <span className="text-xs text-muted">
          vs. <span className="max-2xl:hidden">período </span>anterior
        </span>
      </div>
    </Hint>
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
        {hint ? (
          <Hint content={`${label} — ${hint}`}>
            <p tabIndex={0} className="truncate rounded-xs text-sm text-fg focus-visible:focus-ring">
              {label}
            </p>
          </Hint>
        ) : (
          <p className="truncate text-sm text-fg">{label}</p>
        )}
      </div>
      <p className="text-2xl font-semibold tracking-[-0.01em] whitespace-nowrap text-fg tabular">{value}</p>
      <div className="flex items-end justify-between gap-2">
        <DeltaLine delta={delta} comparison={comparison} />
        <div className="h-9 min-w-0 flex-1 max-w-28" aria-hidden="true">
          {trend.length > 1 && <Sparkline values={trend} />}
        </div>
      </div>
    </Panel>
  )
}

/**
 * Os KPIs no celular: faixa que rola na horizontal com encaixe, duas de cada vez. A rolagem é do
 * próprio trilho, então a página não rola de lado. Pelo teclado, Tab já percorre os cartões (o
 * navegador traz o foco para a vista); as setas movem de página para quem estiver com o trilho em foco.
 */
export function KpiCarousel({ children, label }: { children: ReactNode[]; label: string }) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [page, setPage] = useState(0)
  const pages = Math.ceil(children.length / 2)

  function goTo(next: number) {
    const track = trackRef.current
    if (!track) return
    const target = Math.max(0, Math.min(pages - 1, next))
    track.scrollTo({ left: target * track.clientWidth, behavior: "smooth" })
  }

  return (
    <div className="flex flex-col gap-2">
      <ul
        ref={trackRef}
        aria-label={label}
        tabIndex={0}
        onScroll={(event) => {
          const track = event.currentTarget
          setPage(track.clientWidth === 0 ? 0 : Math.round(track.scrollLeft / track.clientWidth))
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
          event.preventDefault()
          goTo(page + (event.key === "ArrowRight" ? 1 : -1))
        }}
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 scrollbar-none focus-visible:focus-ring"
      >
        {children.map((child, index) => (
          <li key={index} className="w-[calc(50%-0.375rem)] shrink-0 snap-start">
            {child}
          </li>
        ))}
      </ul>
      <div className="flex justify-center gap-1.5" aria-hidden="true">
        {Array.from({ length: pages }, (_, index) => (
          <button
            key={index}
            type="button"
            tabIndex={-1}
            onClick={() => goTo(index)}
            className={cn("h-1 w-5 cursor-pointer rounded-full transition-colors", index === page ? "bg-accent" : "bg-line-strong")}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── Pipeline ──────────────────────────────────────────────────────────────── */

type FunnelNode = {
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

function stageHint(node: FunnelNode, stalledAfterDays: number) {
  const lines = [
    `${numberFormatter.format(node.count)} negócios abertos nesta etapa (pipeline atual)`,
    `${node.amount > 0 ? formatMoneyWhole(node.amount) : "sem valor informado"}${node.estimated > 0 ? ` · ${numberFormatter.format(node.estimated)} com valor estimado pelo ticket` : ""}`,
    node.percent === null
      ? "Ainda sem histórico para calcular quantos avançam."
      : `${formatPercent(node.percent)} dos negócios que entraram nesta etapa avançaram para uma etapa posterior ou para Ganho.`,
  ]

  if (node.averageDays !== null) {
    lines.push(`Tempo médio na etapa: ${numberFormatter.format(Math.round(node.averageDays))} dias.`)
  }

  // O limite vale para a organização inteira e é ajustável; o tooltip sempre diz qual está valendo.
  lines.push(
    node.stalled > 0
      ? `${numberFormatter.format(node.stalled)} parados: sem mudar de etapa há mais de ${stalledAfterDays} dias.`
      : `Nenhum parado (limite: ${stalledAfterDays} dias sem mudar de etapa).`
  )

  lines.push("Clique para abrir no Pipeline.")
  return lines.join("\n")
}

function wonHint(node: FunnelNode, periodName: string) {
  return [
    "Ganhos fechados no período (não fazem parte do pipeline aberto)",
    `${periodName} · ${numberFormatter.format(node.count)} negócios · ${node.amount > 0 ? formatMoneyWhole(node.amount) : "sem valor informado"}`,
    node.percent === null ? "Sem fechamentos no período." : `Taxa de fechamento: ${formatPercent(node.percent)} (${CLOSE_RATE_HINT}).`,
  ].join("\n")
}

/** O miolo visual do nó — o mesmo para etapa (botão) e para ganhos (só leitura). */
function FunnelNodeBody({ node, isWon }: { node: FunnelNode; isWon: boolean }) {
  return (
    <>
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
        <p className="truncate text-xs text-fg-muted transition-colors group-hover:text-fg">{node.label}</p>
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
    </>
  )
}

/**
 * O funil como linha do tempo horizontal: nó, filete vertical, volume e a conversão histórica
 * da etapa ("x% avançam"), calculada de StageChange — não a participação da fotografia atual.
 * Cada etapa abre o Pipeline naquela coluna. O último nó são os ganhos **do período**, depois de
 * um filete tracejado: não é etapa do pipeline aberto e não navega.
 */
export function PipelineCard({
  pipeline,
  advanceRates,
  wonInPeriod,
  wonAmount,
  closeRateValue,
  stalledAfterDays,
  periodShort,
  periodName,
  onOpenStage,
  compact = false,
}: {
  pipeline: PipelineStage[]
  advanceRates: StageAdvanceRate[]
  wonInPeriod: number
  wonAmount: number
  closeRateValue: number | null
  stalledAfterDays: number
  /** Rótulo curto do período: "30 dias", "mês anterior", "período". */
  periodShort: string
  periodName: string
  onOpenStage: (stage: DealStage) => void
  /** No celular o funil vira lista: etapa, quantidade, valor e % que avança, um por linha. */
  compact?: boolean
}) {
  const byStage = new Map(pipeline.map((s) => [s.stage, s]))
  const advanceByStage = new Map(advanceRates.map((s) => [s.stage, s]))
  const totalOpen = pipeline.reduce((sum, s) => sum + s.count, 0)

  const stages = ACTIVE_STAGES.map((stage: DealStage) => {
    const data = byStage.get(stage)
    const advance = advanceByStage.get(stage)
    const node: FunnelNode = {
      label: stageLabels[stage],
      count: data?.count ?? 0,
      amount: data?.amount ?? 0,
      estimated: data?.estimatedCount ?? 0,
      percent: advance?.advanceRate ?? null,
      percentLabel: advance?.advanceRate == null ? "—" : `${formatPercent(advance.advanceRate)} avançam`,
      averageDays: advance?.averageDaysInStage ?? null,
      stalled: data?.stalledCount ?? 0,
    }
    return { stage, node }
  })

  const wonNode: FunnelNode = {
    label: `Ganhos · ${periodShort}`,
    count: wonInPeriod,
    amount: wonAmount,
    estimated: 0,
    percent: closeRateValue,
    // O cabeçalho do card já nomeia a taxa; aqui só o número, para não truncar na coluna estreita.
    percentLabel: closeRateValue === null ? "—" : formatPercent(closeRateValue),
    averageDays: null,
    stalled: 0,
  }

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
            <Hint content={`Taxa de fechamento — ${CLOSE_RATE_HINT} · ${periodName}`}>
              <div tabIndex={0} className="rounded-xs pl-5 focus-visible:focus-ring">
                <dt className="text-xs text-muted">Taxa de fechamento</dt>
                <dd className="text-md font-medium text-fg tabular">
                  {closeRateValue === null ? "—" : formatPercent(closeRateValue)}
                </dd>
              </div>
            </Hint>
          </dl>
        }
      />

      {compact ? (
        <ol className="flex flex-col divide-y divide-line-soft/70 border-t border-line-soft">
          {stages.map(({ stage, node }) => (
            <li key={stage}>
              {/* Sem `openOnTap`: aqui o toque tem que abrir o Pipeline. O tooltip continua alcançável
                  pelo teclado, e o essencial (valor, % que avança, parados) está na própria linha. */}
              <Hint content={stageHint(node, stalledAfterDays)}>
                <button
                  type="button"
                  onClick={() => onOpenStage(stage)}
                  aria-label={`${node.label}: ${numberFormatter.format(node.count)} negócios, ${node.amount > 0 ? formatMoneyWhole(node.amount) : "sem valor"}. Abrir no Pipeline`}
                  className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-sm px-1 py-2 text-left transition-colors active:bg-surface-3/40 focus-visible:focus-ring"
                >
                  <span
                    aria-hidden="true"
                    className={cn("size-2.5 shrink-0 rounded-full border-2", node.count > 0 ? "border-accent" : "border-line-strong")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">{node.label}</span>
                    <span className="block text-2xs text-muted tabular">
                      {node.percentLabel}
                      {node.stalled > 0 && <span className="text-danger"> · {node.stalled} parados</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={cn("block text-md font-semibold text-fg tabular", node.count === 0 && "text-faint")}>
                      {numberFormatter.format(node.count)}
                    </span>
                    <span className="block text-2xs text-fg-muted tabular">
                      {node.amount > 0 ? `${node.estimated > 0 ? "~" : ""}${formatMoneyCompact(node.amount)}` : "R$ —"}
                    </span>
                  </span>
                </button>
              </Hint>
            </li>
          ))}
          <li className="border-t border-dashed border-line-strong/70">
            <Hint content={wonHint(wonNode, periodName)} openOnTap>
              <div
                tabIndex={0}
                className="flex min-h-11 w-full items-center gap-3 rounded-sm px-1 py-2 focus-visible:focus-ring"
              >
                <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full border-2 border-accent", wonNode.count > 0 && "bg-accent")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">{wonNode.label}</span>
                  <span className="block text-2xs text-muted tabular">{wonNode.percentLabel}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-md font-semibold text-fg tabular">{numberFormatter.format(wonNode.count)}</span>
                  <span className="block text-2xs text-fg-muted tabular">
                    {wonNode.amount > 0 ? formatMoneyCompact(wonNode.amount) : "R$ —"}
                  </span>
                </span>
              </div>
            </Hint>
          </li>
        </ol>
      ) : (
        <ol className="grid grid-cols-2 gap-y-5 border-t border-line-soft pt-3 sm:grid-cols-4 xl:grid-cols-8">
          {stages.map(({ stage, node }) => (
            <li key={stage} className="relative min-w-0">
              <Hint content={stageHint(node, stalledAfterDays)}>
                <button
                  type="button"
                  onClick={() => onOpenStage(stage)}
                  aria-label={`${node.label}: ${numberFormatter.format(node.count)} negócios, ${node.amount > 0 ? formatMoneyWhole(node.amount) : "sem valor"}. Abrir no Pipeline`}
                  className="group flex size-full min-w-0 cursor-pointer gap-2.5 rounded-sm pr-2 text-left outline-offset-4 transition-colors hover:bg-surface-3/40 focus-visible:focus-ring"
                >
                  <FunnelNodeBody node={node} isWon={false} />
                </button>
              </Hint>
            </li>
          ))}
          {/* Filete tracejado: à direita dele é resultado do período, não fotografia do funil. */}
          <li className="relative min-w-0 xl:border-l xl:border-dashed xl:border-line-strong/70 xl:pl-3">
            <Hint content={wonHint(wonNode, periodName)} openOnTap>
              <div tabIndex={0} className="flex size-full min-w-0 gap-2.5 rounded-sm pr-2 outline-offset-4 focus-visible:focus-ring">
                <FunnelNodeBody node={wonNode} isWon />
              </div>
            </Hint>
          </li>
        </ol>
      )}
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

/**
 * A linha inteira abre o negócio (atalho de ponteiro); pelo teclado, o nome da empresa e o menu
 * "⋯" são os alvos. Abaixo de 1700px o responsável vira só avatar, com o nome no tooltip.
 */
export function FeaturedDealsCard({
  deals,
  today,
  onOpenDeal,
  onOpenCompany,
  compact = false,
}: {
  deals: FeaturedDeal[]
  /** "Hoje" da organização (data local), para marcar previsão vencida sem depender do fuso do navegador. */
  today: string
  onOpenDeal: (dealId: string) => void
  onOpenCompany: (companyId: string) => void
  /** No celular vira lista de cards: uma tabela de 6 colunas só rolaria na horizontal. */
  compact?: boolean
}) {
  return (
    <Panel aria-labelledby="featured-heading" className="gap-2 px-4 pt-4 pb-2">
      <PanelHeading id="featured-heading" title="Negócios em Destaque" />
      {deals.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-muted">
          Nenhum negócio aberto com valor ou ticket informado.
        </p>
      ) : compact ? (
        <ul className="flex flex-col gap-2 pb-2">
          {deals.map((deal) => (
            <li key={deal.id} className="rounded-md border border-line-soft bg-surface-2/40 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onOpenDeal(deal.id)}
                  className="min-h-11 min-w-0 flex-1 cursor-pointer rounded-xs text-left focus-visible:focus-ring"
                >
                  <span className="block truncate text-sm text-fg">{deal.companyName}</span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="text-md font-semibold text-fg tabular">
                      {deal.amount === null ? "—" : formatMoneyWhole(deal.amount)}
                    </span>
                    {deal.isEstimated && <span className="text-2xs text-muted">est.</span>}
                  </span>
                </button>
                <DealRowMenu deal={deal} onOpenDeal={onOpenDeal} onOpenCompany={onOpenCompany} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs">
                <span className={cn("inline-flex rounded-sm px-2 py-0.5", stageTone[deal.stage])}>{stageLabels[deal.stage]}</span>
                <span className="text-fg-muted">{deal.ownerUserName.split(/\s+/)[0]}</span>
                <span className={cn("tabular", deal.expectedCloseDate && deal.expectedCloseDate < today ? "text-danger" : "text-muted")}>
                  {deal.expectedCloseDate ? `Previsão ${formatLocalDay(deal.expectedCloseDate)}` : "Sem previsão"}
                </span>
                <span className={cn("tabular", !deal.nextTaskDueDate ? "text-danger" : "text-muted")}>
                  {deal.nextTaskDueDate ? `Ação ${formatInstantDay(deal.nextTaskDueDate)}` : "Sem ação"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-2xs text-muted">
                <th scope="col" className="pb-2 font-normal">Empresa</th>
                <th scope="col" className="pb-2 font-normal">Valor</th>
                <th scope="col" className="pb-2 font-normal">Etapa</th>
                <th scope="col" className="pb-2 font-normal">
                  <span className="max-[1699px]:sr-only">Responsável</span>
                  <span aria-hidden="true" className="min-[1700px]:hidden">Resp.</span>
                </th>
                <th scope="col" className="pb-2 font-normal">
                  <Hint content="Previsão de fechamento (vermelho quando já passou) e, embaixo, a próxima ação pendente.">
                    <span>Previsão</span>
                  </Hint>
                </th>
                <th scope="col" className="sticky right-0 w-8 bg-surface pb-2">
                  <span className="sr-only">Mais ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft/70 border-t border-line-soft/70">
              {deals.map((deal) => (
                <tr key={deal.id} onClick={() => onOpenDeal(deal.id)} className="group cursor-pointer transition-colors hover:bg-surface-3/40">
                  <td className="py-1 pr-2 min-[1700px]:pr-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm border border-line-soft bg-surface-3 font-mono text-[0.5625rem] text-fg-muted max-[1699px]:hidden"
                      >
                        {initialsOf(deal.companyName)}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpenDeal(deal.id)
                        }}
                        className="max-w-36 cursor-pointer truncate rounded-xs text-left text-fg group-hover:underline focus-visible:focus-ring min-[1700px]:max-w-40"
                      >
                        {deal.companyName}
                      </button>
                    </span>
                  </td>
                  <td className="py-1 pr-2 min-[1700px]:pr-3 whitespace-nowrap text-fg tabular">
                    {deal.amount === null ? (
                      "—"
                    ) : (
                      <>
                        {formatMoneyWhole(deal.amount)}
                        {deal.isEstimated && (
                          <Hint content="Valor estimado pelo ticket — o negócio ainda não tem valor em negociação.">
                            <span className="ml-1 text-2xs text-muted">est.</span>
                          </Hint>
                        )}
                      </>
                    )}
                  </td>
                  <td className="py-1 pr-2 min-[1700px]:pr-3">
                    <span className={cn("inline-flex rounded-sm px-2 py-0.5 text-2xs whitespace-nowrap", stageTone[deal.stage])}>
                      {stageLabels[deal.stage]}
                    </span>
                  </td>
                  <td className="py-1 pr-2 min-[1700px]:pr-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <Hint content={deal.ownerUserName}>
                        <span className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[0.5625rem] font-medium text-fg-muted ring-1 ring-line-strong/50">
                          <span aria-hidden="true">{initialsOf(deal.ownerUserName)}</span>
                          <span className="sr-only min-[1700px]:hidden">{deal.ownerUserName}</span>
                        </span>
                      </Hint>
                      <span className="max-w-32 truncate text-fg-muted max-[1699px]:hidden">{deal.ownerUserName.split(/\s+/)[0]}</span>
                    </span>
                  </td>
                  {/* Duas linhas curtas na altura de uma linha de avatar: previsão em cima, próxima ação embaixo. */}
                  <td className="py-0.5 pr-2 whitespace-nowrap tabular min-[1700px]:pr-3">
                    {/* relative: o texto sr-only fica preso na área de rolagem da tabela em vez de esticar a página. */}
                    <span className="relative flex flex-col">
                      {deal.expectedCloseDate ? (
                        <span className={cn("text-xs/3.5", deal.expectedCloseDate < today ? "text-danger" : "text-fg")}>
                          {formatLocalDay(deal.expectedCloseDate)}
                          {deal.expectedCloseDate < today && <span className="sr-only"> (previsão vencida)</span>}
                        </span>
                      ) : (
                        <span className="text-xs/3.5 text-faint">
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">sem previsão</span>
                        </span>
                      )}
                      <span
                        className={cn(
                          "text-2xs/3.5",
                          !deal.nextTaskDueDate || new Date(deal.nextTaskDueDate) < new Date() ? "text-danger" : "text-muted"
                        )}
                      >
                        {deal.nextTaskDueDate ? `Ação ${formatInstantDay(deal.nextTaskDueDate)}` : "Sem ação"}
                      </span>
                    </span>
                  </td>
                  {/* Fixa na borda direita: se a tabela ainda rolar na horizontal, o menu continua à vista. */}
                  <td className="sticky right-0 bg-surface py-1 pl-1 text-right" onClick={(event) => event.stopPropagation()}>
                    <DealRowMenu deal={deal} onOpenDeal={onOpenDeal} onOpenCompany={onOpenCompany} />
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

function DealRowMenu({
  deal,
  onOpenDeal,
  onOpenCompany,
}: {
  deal: FeaturedDeal
  onOpenDeal: (dealId: string) => void
  onOpenCompany: (companyId: string) => void
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Ações do negócio de ${deal.companyName}`}
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-3 hover:text-fg focus-visible:focus-ring data-[state=open]:bg-surface-3 data-[state=open]:text-fg"
        >
          <Ellipsis className="size-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      {/* O menu vai para um portal, mas o clique ainda borbulha pela árvore React até a linha. */}
      <DropdownMenuContent onClick={(event) => event.stopPropagation()}>
        <DropdownMenuItem onSelect={() => onOpenDeal(deal.id)}>
          <SquareArrowOutUpRight aria-hidden="true" />
          Abrir negócio
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onOpenCompany(deal.companyId)}>
          <Building2 aria-hidden="true" />
          Abrir empresa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ─── Cartão Metup (potencial) ──────────────────────────────────────────────── */

/**
 * "Previsto para fechar": para a frente, de hoje até o fim da janela com a duração do período.
 * Sem nenhuma previsão preenchida, convida a preencher em vez de mostrar R$ 0 sem contexto.
 */
function ExpectedCloseLine({ expectedClose }: { expectedClose: ExpectedClose }) {
  const days = daysInclusive(expectedClose.windowStartLocal, expectedClose.windowEndLocal)
  const windowName = days === 1 ? "hoje" : `nos próximos ${numberFormatter.format(days)} dias`
  const range = `${formatLocalDay(expectedClose.windowStartLocal)} – ${formatLocalDay(expectedClose.windowEndLocal)}`

  if (expectedClose.openDealsWithExpectedCloseDate === 0) {
    return (
      <p data-testid="expected-close-line" className="line-clamp-2 shrink-0 text-xs text-fg-muted max-[1699px]:line-clamp-1">
        <span className="max-[1699px]:hidden">Preencha a previsão de fechamento dos negócios para ver o que deve entrar {windowName}.</span>
        <span className="min-[1700px]:hidden">Preencha a previsão de fechamento dos negócios.</span>
      </p>
    )
  }

  const count = expectedClose.expectedToCloseCount
  const overdue = expectedClose.overdueExpectedCount
  return (
    <Hint
      content={`Previsto para fechar ${windowName}: ${formatMoneyWhole(expectedClose.expectedToCloseAmount)} (${numberFormatter.format(count)} ${count === 1 ? "negócio" : "negócios"}).\nSoma do valor dos negócios abertos com previsão de fechamento entre ${range}.${overdue > 0 ? `\n${numberFormatter.format(overdue)} negócios abertos estão com a previsão vencida.` : ""}`}
    >
      <p data-testid="expected-close-line" tabIndex={0} className="line-clamp-2 w-fit shrink-0 max-[1599px]:line-clamp-1 rounded-xs text-xs text-fg focus-visible:focus-ring">
        {/* Abaixo de 1700px o cartão é estreito: versão curta; o tooltip mantém a frase inteira. */}
        <span className="max-[1699px]:hidden">
          Previsto para fechar {windowName}:{" "}
          <span className="font-medium tabular">{formatMoneyWhole(expectedClose.expectedToCloseAmount)}</span>{" "}
          <span className="text-fg-muted">
            ({numberFormatter.format(count)} {count === 1 ? "negócio" : "negócios"})
          </span>
        </span>
        <span className="min-[1700px]:hidden">
          Fecha {days === 1 ? "hoje" : `em ${numberFormatter.format(days)}d`}:{" "}
          <span className="font-medium tabular">{formatMoneyCompact(expectedClose.expectedToCloseAmount)}</span>{" "}
          <span className="text-fg-muted">({numberFormatter.format(count)})</span>
        </span>
        {overdue > 0 && (
          <span className="text-danger"> · {numberFormatter.format(overdue)} {overdue === 1 ? "vencida" : "vencidas"}</span>
        )}
      </p>
    </Hint>
  )
}

const FORECAST_HINT = "Valor aberto ponderado pela taxa histórica de fechamento de cada etapa; não depende do período."

/**
 * Assinatura visual da marca: linhas de "arquitetura" em dourado, com dados reais do potencial.
 * Tudo aqui é fotografia do pipeline atual — o rótulo diz isso, para ninguém ler como "do período".
 */
export function PotentialCard({
  openAmount,
  forecast,
  expectedClose,
  closingAmount,
  onOpenPipeline,
}: {
  openAmount: number
  forecast: number | null
  expectedClose: ExpectedClose
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

      <div className="relative flex h-full max-w-[68%] flex-col justify-center gap-2.5 max-[1599px]:gap-1.5">
        <Hint
          content={
            forecast === null ? `${FORECAST_HINT}\nSem previsão: ainda não há histórico de fechamento para calibrar.` : FORECAST_HINT
          }
        >
          <p tabIndex={0} className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-xs label-mono max-[1599px]:whitespace-nowrap text-accent focus-visible:focus-ring">
            Previsto no pipeline atual
            <Info className="size-3 max-[1599px]:hidden" aria-hidden="true" />
          </p>
        </Hint>
        <h2 id="potential-heading" className="text-md leading-snug font-medium text-fg min-[1700px]:text-lg">
          {formatMoneyCompact(openAmount)} em aberto,{" "}
          <span className="text-fg-muted">
            {forecast === null ? "sem histórico de fechamento para calibrar." : `${formatMoneyCompact(forecast)} previstos.`}
          </span>
        </h2>
        <ExpectedCloseLine expectedClose={expectedClose} />
        {/* Abaixo de 1700px a dica cede o espaço à linha do previsto: o cartão não cresce nem corta o botão. */}
        <p className="line-clamp-2 text-xs text-fg-muted max-[1699px]:hidden">
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
