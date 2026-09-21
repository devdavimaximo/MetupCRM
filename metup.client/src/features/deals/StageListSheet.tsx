import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { Monogram } from "@/components/ui/monogram"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Alert, Skeleton } from "@/components/ui/states"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { activityTypeLabels } from "@/features/activities/activity-labels"
import { toMessage } from "@/features/companies/form-errors"
import { useAsyncResource, useDebouncedValue } from "@/lib/hooks"
import { formatDue } from "@/lib/format"
import { numberFormatter } from "@/lib/format"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import {
  getDealBoardColumn,
  type DealBoardCard,
  type DealBoardSort,
  type PipelineFilters,
  type PipelinePeriod,
} from "./api"
import { ageTitle, formatAge, lastTouchOf, stalledLabel } from "./board-format"
import { BOARD_SORTS, boardSortLabels, type PipelineListTarget } from "./pipeline-url"
import { stageLabels } from "./stage-labels"

/** Páginas da lista: 25 ou 50 por vez (o servidor aceita até 100 nesta rota). */
const PAGE_SIZES = [25, 50] as const

type PageSize = (typeof PAGE_SIZES)[number]

const columnRefOf = (target: PipelineListTarget) =>
  target.kind === "stage" ? { stage: target.stage } : { closed: target.group }

const titleOf = (target: PipelineListTarget) =>
  target.kind === "stage" ? stageLabels[target.stage] : target.group === "won" ? "Ganhos no período" : "Perdidos no período"

/**
 * A etapa inteira em lista (item 16): tabela paginada no servidor, com busca própria e a mesma
 * ordenação do quadro. É o que substitui despejar centenas de cartões numa coluna — o quadro
 * continua atrás, e fechar volta ao ponto em que ele estava.
 */
export function StageListSheet({
  target,
  params,
  onOpenChange,
  onOpenDeal,
}: {
  target: PipelineListTarget | null
  /** Os filtros vigentes do quadro (responsável, origem, segmento, período, ordenação, parados). */
  params: PipelineFilters & PipelinePeriod & { sort: DealBoardSort }
  onOpenChange: (open: boolean) => void
  onOpenDeal: (dealId: string) => void
}) {
  return (
    <Sheet open={target !== null} onOpenChange={onOpenChange}>
      {target && <StageList target={target} params={params} onOpenDeal={onOpenDeal} />}
    </Sheet>
  )
}

function StageList({
  target,
  params,
  onOpenDeal,
}: {
  target: PipelineListTarget
  params: PipelineFilters & PipelinePeriod & { sort: DealBoardSort }
  onOpenDeal: (dealId: string) => void
}) {
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<DealBoardSort>(params.sort)
  const [pageSize, setPageSize] = useState<PageSize>(25)
  const [page, setPage] = useState(1)
  const debounced = useDebouncedValue(search.trim(), 300)

  // A busca com debounce troca depois do evento, então a volta para a primeira página é derivada:
  // o termo que gerou a página atual fica guardado ao lado dela.
  const [pageTerm, setPageTerm] = useState(debounced)
  if (pageTerm !== debounced) {
    setPageTerm(debounced)
    setPage(1)
  }

  const request = useMemo(
    () => ({ ...params, search: debounced || params.search, sort, page, perColumn: pageSize }),
    [params, debounced, sort, page, pageSize]
  )
  const key = JSON.stringify({ target, request })

  const column = useAsyncResource((signal) => getDealBoardColumn(columnRefOf(target), request, signal), [key], {
    keepPreviousData: true,
  })

  const data = column.data
  const error = column.error !== null ? toMessage(column.error, "Não foi possível carregar a lista.") : null
  const total = data?.count ?? 0
  const lastPage = Math.max(1, Math.ceil(total / pageSize))

  return (
    <SheetContent side="right" className="sm:max-w-3xl">
      <SheetHeader>
        <SheetTitle>{titleOf(target)}</SheetTitle>
        <SheetDescription>
          {data
            ? `${numberFormatter.format(total)} ${total === 1 ? "negócio" : "negócios"} · ${formatMoney(data.total)}${data.totalHasEstimate ? " (com valor estimado)" : ""}`
            : "Carregando…"}
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="flex flex-col gap-3 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar empresa ou contato"
            aria-label="Buscar nesta lista"
            className="min-w-52 flex-1"
          />
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            Ordenar
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as DealBoardSort)
                setPage(1)
              }}
              className="h-8 cursor-pointer rounded-xs border border-line-strong/70 bg-surface px-2 text-xs text-fg focus-visible:focus-ring"
            >
              {BOARD_SORTS.map((value) => (
                <option key={value} value={value}>
                  {boardSortLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            Por página
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value) as PageSize)
                setPage(1)
              }}
              className="h-8 cursor-pointer rounded-xs border border-line-strong/70 bg-surface px-2 text-xs text-fg focus-visible:focus-ring"
            >
              {PAGE_SIZES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && !data ? (
          <Alert onRetry={() => column.reload()}>{error}</Alert>
        ) : !data ? (
          <div role="status" aria-busy className="flex flex-col gap-2">
            <span className="sr-only">Carregando a lista…</span>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">Nenhum negócio com esses filtros.</p>
        ) : (
          <div className={cn("min-w-0 overflow-x-auto transition-opacity", column.isLoading && "opacity-60")}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-2xs text-muted">
                  <th scope="col" className="pb-2 font-normal">Empresa</th>
                  <th scope="col" className="pb-2 font-normal">Valor</th>
                  <th scope="col" className="pb-2 font-normal">Responsável</th>
                  <th scope="col" className="pb-2 font-normal">Há</th>
                  <th scope="col" className="pb-2 font-normal">Próxima tarefa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft/70 border-t border-line-soft/70">
                {data.items.map((deal) => (
                  <ListRow key={deal.id} deal={deal} onOpenDeal={onOpenDeal} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && total > pageSize && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted tabular">
              Página {numberFormatter.format(page)} de {numberFormatter.format(lastPage)}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        )}
      </SheetBody>
    </SheetContent>
  )
}

function ListRow({ deal, onOpenDeal }: { deal: DealBoardCard; onOpenDeal: (dealId: string) => void }) {
  const touch = lastTouchOf(deal)
  return (
    <tr className="group cursor-pointer transition-colors hover:bg-surface-3/40" onClick={() => onOpenDeal(deal.id)}>
      <td className="py-1.5 pr-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onOpenDeal(deal.id)
          }}
          className="max-w-56 cursor-pointer truncate rounded-xs text-left text-fg group-hover:underline focus-visible:focus-ring"
        >
          {deal.companyName}
        </button>
        {deal.isStalled && (
          <Badge variant="accent" dot className="ml-2 align-middle">
            {stalledLabel(deal.daysInStage)}
          </Badge>
        )}
      </td>
      <td className="py-1.5 pr-3 whitespace-nowrap text-fg tabular">
        {formatMoney(deal.value)}
        {deal.valueIsEstimated && <span className="ml-1 text-2xs text-muted">est.</span>}
      </td>
      <td className="py-1.5 pr-3">
        <span className="flex min-w-0 items-center gap-2">
          <Monogram name={deal.ownerUserName} size="xs" />
          <span className="max-w-32 truncate text-fg-muted">{deal.ownerUserName}</span>
        </span>
      </td>
      <td className="py-1.5 pr-3 whitespace-nowrap text-muted tabular">
        <time dateTime={touch.iso} title={ageTitle(deal)}>
          {formatAge(touch.iso)}
        </time>
      </td>
      <td className={cn("py-1.5 whitespace-nowrap tabular", deal.nextTask?.isOverdue ? "text-danger" : "text-muted")}>
        {deal.nextTask ? `${activityTypeLabels[deal.nextTask.type]} · ${formatDue(deal.nextTask.dueDate)}` : "Sem próxima ação"}
      </td>
    </tr>
  )
}
