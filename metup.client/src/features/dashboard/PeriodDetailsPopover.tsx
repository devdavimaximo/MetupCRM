import { ArrowDown, ArrowUp, ListFilter, Minus } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Hint } from "@/components/ui/tooltip"
import { numberFormatter } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { DashboardOverview, DealScope } from "./api"
import { comparisonRange, deltaOf, formatMoneyWhole, type Delta, type DeltaContext } from "./dashboard-format"

/**
 * O trabalho do período que não cabe nos quatro KPIs: quanto entrou no funil e quanta atividade
 * comercial aconteceu, mais o recorte por responsável. Sai do que o overview já calcula — nenhum
 * número novo, nenhum cartão novo na grade.
 */
type Measure = { label: string; value: number; formula: string; delta: Delta }

function measures(overview: DashboardOverview, context: DeltaContext): Measure[] {
  return [
    {
      label: "Novos negócios",
      value: overview.newDeals.current,
      formula: "negócios criados no período, por data de criação",
      delta: deltaOf(overview.newDeals, context),
    },
    {
      label: "Ligações",
      value: overview.callsMade.current,
      formula: "atividades do tipo Ligação registradas no período",
      delta: deltaOf(overview.callsMade, context),
    },
    {
      label: "Reuniões",
      value: overview.meetingsHeld.current,
      formula: "atividades do tipo Reunião registradas no período",
      delta: deltaOf(overview.meetingsHeld, context),
    },
    {
      label: "Propostas",
      value: overview.proposalsSent.current,
      formula: "atividades do tipo Proposta registradas no período",
      delta: deltaOf(overview.proposalsSent, context),
    },
  ]
}

/** Variação em uma linha, com o intervalo da comparação no tooltip. */
function DeltaBadge({ delta, comparison }: { delta: Delta; comparison: string }) {
  if (delta.kind === "no-history" || delta.kind === "no-base") {
    return <span className="text-xs text-muted">sem base anterior</span>
  }
  if (delta.kind === "new") {
    return <span className="text-xs text-success">novo no período</span>
  }
  if (delta.kind === "idle") {
    return <span className="text-xs text-muted">sem movimento</span>
  }

  const Icon = delta.direction === "up" ? ArrowUp : delta.direction === "down" ? ArrowDown : Minus
  return (
    <Hint content={`Comparado com ${comparison}.`}>
      <span
        tabIndex={0}
        className={cn(
          "inline-flex items-center gap-1 rounded-xs text-xs tabular focus-visible:focus-ring",
          delta.direction === "up" && "text-success",
          delta.direction === "down" && "text-danger",
          delta.direction === "flat" && "text-fg-muted"
        )}
      >
        <Icon className="size-3" aria-hidden="true" />
        {delta.label}
      </span>
    </Hint>
  )
}

export function PeriodDetailsPopover({
  overview,
  periodName,
  scope,
  currentUserName,
}: {
  overview: DashboardOverview | null
  periodName: string
  scope: DealScope
  currentUserName: string
}) {
  const context: DeltaContext | null = overview
    ? { historyStart: overview.historyStart, previousStart: overview.previousStart, periodStart: overview.periodStart }
    : null
  const comparison = context ? comparisonRange(context) : ""
  const owners = overview?.owners ?? []
  // Na própria carteira, uma lista de um nome só repetiria o que o cabeçalho já diz.
  const showOwners = owners.length > 0 && !(scope === "Mine" && owners.length === 1 && owners[0].ownerUserName === currentUserName)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={overview === null}
          aria-label={`Detalhes do período: ${periodName}`}
          className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line-soft bg-surface text-fg-muted transition-colors hover:border-line-strong hover:text-fg focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-line-strong data-[state=open]:text-fg"
        >
          <ListFilter className="size-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>

      <PopoverContent aria-label={`Detalhes do período: ${periodName}`} className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        {overview && context && (
          <div className="flex max-h-[min(30rem,70vh)] flex-col overflow-y-auto">
            <header className="border-b border-line-soft px-4 py-3">
              <h2 className="text-sm font-medium text-fg">Detalhes do período</h2>
              <p className="text-xs text-muted">{periodName}</p>
            </header>

            <section aria-labelledby="period-activity-heading" className="px-4 py-3">
              <h3 id="period-activity-heading" className="label-mono mb-2 text-faint">
                Atividade no período
              </h3>
              <dl className="flex flex-col gap-1.5">
                {measures(overview, context).map((measure) => (
                  <div key={measure.label} className="flex items-baseline justify-between gap-3">
                    <Hint content={measure.formula}>
                      <dt tabIndex={0} className="rounded-xs text-sm text-fg-muted focus-visible:focus-ring">
                        {measure.label}
                      </dt>
                    </Hint>
                    <dd className="flex items-baseline gap-2">
                      <span className="text-sm text-fg tabular">{numberFormatter.format(measure.value)}</span>
                      <DeltaBadge delta={measure.delta} comparison={comparison} />
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-2xs text-muted">
                "Propostas" conta atividades do tipo Proposta enquanto a proposta não tiver entidade própria.
              </p>
            </section>

            {showOwners && (
              <section aria-labelledby="period-owners-heading" className="border-t border-line-soft px-4 py-3">
                <h3 id="period-owners-heading" className="label-mono mb-2 text-faint">
                  Responsáveis
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-2xs text-muted">
                      <th scope="col" className="pb-1 text-left font-normal">
                        Quem
                      </th>
                      <th scope="col" className="pb-1 text-right font-normal">
                        Ganhos
                      </th>
                      <th scope="col" className="pb-1 text-right font-normal">
                        Receita
                      </th>
                      <th scope="col" className="pb-1 text-right font-normal">
                        Em aberto
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {owners.map((owner) => (
                      <tr key={owner.ownerUserId} className="border-t border-line-soft/60">
                        <th scope="row" className="max-w-32 truncate py-1 text-left font-normal text-fg-muted">
                          {owner.ownerUserName}
                        </th>
                        <td className="py-1 text-right text-fg tabular">{numberFormatter.format(owner.wonDeals)}</td>
                        <td className="py-1 text-right text-fg tabular">{formatMoneyWhole(owner.revenue)}</td>
                        <td className="py-1 text-right text-fg-muted tabular">
                          <Hint content={`${numberFormatter.format(owner.openDeals)} negócios abertos`}>
                            <span tabIndex={0} className="rounded-xs focus-visible:focus-ring">
                              {formatMoneyWhole(owner.openAmount)}
                            </span>
                          </Hint>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
