import { useCallback, useEffect, useState } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/ui/page"
import { Select } from "@/components/ui/select"
import { Alert, Skeleton } from "@/components/ui/states"
import { toMessage } from "@/features/companies/form-errors"
import { numberFormatter, pluralize } from "@/lib/format"
import { formatMoney } from "@/lib/money"
import { readUrlState, writeUrlState } from "@/lib/url-state"
import { DealBoard } from "./DealBoard"
import { DealDrawer, type DealDrawerTarget } from "./DealDrawer"
import {
  changeDealStage,
  listDeals,
  listUsers,
  type DealListItem,
  type DealSource,
  type DealStage,
  type UserSummary,
} from "./api"
import { ALL_STAGES, sourceLabels } from "./stage-labels"

type Props = {
  onOpenCompany: (companyId: string) => void
  newDealIntent?: { companyId: string; companyName: string } | null
}

export function PipelinePage({ onOpenCompany, newDealIntent }: Props) {
  const initialUrlState = readUrlState()

  const [deals, setDeals] = useState<DealListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)

  const [ownerUserId, setOwnerUserId] = useState(initialUrlState.ownerUserId)
  const [source, setSource] = useState<DealSource | "">(initialUrlState.source as DealSource | "")

  const [users, setUsers] = useState<UserSummary[]>([])
  // Chegada vinda do dashboard (?etapa=Proposta): a coluna é rolada e destacada, sem filtrar as outras.
  const [highlightStage] = useState<DealStage | null>(() =>
    ALL_STAGES.includes(initialUrlState.pipelineStage as DealStage) ? (initialUrlState.pipelineStage as DealStage) : null
  )

  const [target, setTarget] = useState<DealDrawerTarget>(() => {
    if (newDealIntent) return { mode: "new", ...newDealIntent }
    const dealId = readUrlState().dealId
    return dealId ? { mode: "deal", id: dealId } : null
  })

  const [movingDealId, setMovingDealId] = useState<string | null>(null)
  const [boardError, setBoardError] = useState<string | null>(null)

  const reload = useCallback(() => setReloadVersion((v) => v + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    listDeals(
      { pageSize: 200, ownerUserId: ownerUserId || undefined, source: source || undefined },
      controller.signal
    )
      .then((result) => {
        setDeals(result.items)
        setTotalCount(result.totalCount)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(toMessage(err, "Não foi possível carregar o pipeline."))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [ownerUserId, source, reloadVersion])

  useEffect(() => {
    const controller = new AbortController()
    listUsers(controller.signal)
      .then(setUsers)
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    writeUrlState({ ownerUserId, source })
  }, [ownerUserId, source])

  function openDeal(dealId: string) {
    writeUrlState({ dealId })
    setTarget({ mode: "deal", id: dealId })
  }

  function closeDrawer() {
    writeUrlState({ dealId: null })
    setTarget(null)
  }

  async function handleMoveStage(dealId: string, stage: DealStage) {
    setMovingDealId(dealId)
    setBoardError(null)

    try {
      await changeDealStage(dealId, stage)
      reload()
    } catch (err) {
      setBoardError(toMessage(err, "Não foi possível mover o negócio de estágio."))
    } finally {
      setMovingDealId(null)
    }
  }

  const openDeals = deals.filter((d) => d.status === "Aberto")
  const openValue = openDeals.reduce((sum, d) => sum + (d.amount ?? d.ticket ?? 0), 0)
  const hasFilters = Boolean(ownerUserId || source)

  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-128 flex-col lg:h-svh">
      <div className="flex shrink-0 flex-col gap-5 px-4 pt-6 pb-5 sm:px-6 lg:px-10 lg:pt-10">
        <PageHeader
          eyebrow="Comercial"
          title="Pipeline"
          description={
            isLoading && deals.length === 0 ? (
              "Carregando o funil…"
            ) : (
              <>
                {pluralize(openDeals.length, "negócio em aberto", "negócios em aberto")}
                <span className="mx-2 text-faint">·</span>
                <span className="text-fg tabular">{formatMoney(openValue)}</span> em negociação
                {totalCount > deals.length && (
                  <>
                    <span className="mx-2 text-faint">·</span>
                    <span className="text-muted">
                      exibindo {numberFormatter.format(deals.length)} de {numberFormatter.format(totalCount)}
                    </span>
                  </>
                )}
              </>
            )
          }
          actions={
            <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:w-auto">
              <Label htmlFor="pipeline-filter-owner" className="sr-only">
                Filtrar por responsável
              </Label>
              <Select
                id="pipeline-filter-owner"
                value={ownerUserId}
                onChange={(e) => setOwnerUserId(e.target.value)}
                className="h-9 w-full sm:w-56"
              >
                <option value="">Todos os responsáveis</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </Select>

              <Label htmlFor="pipeline-filter-source" className="sr-only">
                Filtrar por origem
              </Label>
              <Select
                id="pipeline-filter-source"
                value={source}
                onChange={(e) => setSource(e.target.value as DealSource | "")}
                className="h-9 w-full sm:w-44"
              >
                <option value="">Todas as origens</option>
                {Object.entries(sourceLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>

              {hasFilters && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Limpar filtros"
                  title="Limpar filtros"
                  onClick={() => {
                    setOwnerUserId("")
                    setSource("")
                  }}
                >
                  <X aria-hidden="true" />
                </Button>
              )}
            </div>
          }
        />

        {error && <Alert onRetry={reload}>{error}</Alert>}
        {boardError && <Alert>{boardError}</Alert>}
      </div>

      {isLoading && deals.length === 0 && !error && <BoardSkeleton />}

      {!error && (isLoading === false || deals.length > 0) && (
        <DealBoard
          deals={deals}
          movingDealId={movingDealId}
          highlightStage={highlightStage}
          onOpenDeal={openDeal}
          onMoveStage={handleMoveStage}
        />
      )}

      <DealDrawer
        target={target}
        users={users}
        onOpenChange={(open) => {
          if (!open) closeDrawer()
        }}
        onOpenCompany={onOpenCompany}
        onSaved={reload}
      />
    </div>
  )
}

function BoardSkeleton() {
  return (
    <div role="status" className="flex min-h-0 flex-1 gap-3 overflow-hidden px-4 pb-4 sm:px-6 lg:px-10">
      <span className="sr-only">Carregando pipeline…</span>
      {ALL_STAGES.slice(0, 6).map((stage, i) => (
        <div key={stage} className="flex w-[18rem] shrink-0 flex-col gap-2 rounded-sm border border-line-soft bg-sunken/60 p-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mb-2 h-2.5 w-16" />
          {Array.from({ length: 4 - (i % 3) }, (_, j) => (
            <Skeleton key={j} className="h-20 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}
