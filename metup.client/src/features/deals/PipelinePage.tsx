import { useState } from "react"
import { Plus } from "lucide-react"

import { OwnerPicker } from "@/components/OwnerPicker"
import { Alert, Skeleton } from "@/components/ui/states"
import { Toaster } from "@/components/ui/toast"
import { toMessage } from "@/features/companies/form-errors"
import { listCompanyFilterOptions } from "@/features/companies/api"
import { NewTaskSheet } from "@/features/tasks/NewTaskSheet"
import type { AuthenticatedUser } from "@/lib/auth"
import { useAsyncResource } from "@/lib/hooks"
import { readUrlState, writeUrlState } from "@/lib/url-state"
import { cn } from "@/lib/utils"
import { CloseDealDialog } from "./CloseDealForm"
import type { CloseOutcome } from "./close-deal"
import { DealBoard } from "./DealBoard"
import { DealDrawer, type DealDrawerTarget } from "./DealDrawer"
import { dealSectionFromUrl } from "./deal-section"
import { listUsers, type DealBoardCard, type DealStage } from "./api"
import { PipelineFilters, PipelineHeader } from "./PipelineToolbar"
import { ACTIVE_STAGES } from "./stage-labels"
import { useDealBoard } from "./useDealBoard"

type Props = {
  user: AuthenticatedUser
  onOpenCompany: (companyId: string) => void
  newDealIntent?: { companyId: string; companyName: string } | null
}

type CloseRequest = { card: DealBoardCard; outcome: CloseOutcome }

/**
 * Pipeline Comercial: cabeçalho, filtros e o quadro com arrastar e soltar. A PL3 acrescenta KPIs,
 * funil e a faixa inferior entre os filtros e o quadro (ver "Layout" no plano) — o quadro tem altura
 * própria justamente para a página poder crescer em volta dele.
 */
export function PipelinePage({ user, onOpenCompany, newDealIntent }: Props) {
  const canSeeOthers = user.role === "Admin" || user.role === "Closer"
  const view = useDealBoard(canSeeOthers)
  const users = useAsyncResource((signal) => listUsers(signal), [])
  const filterOptions = useAsyncResource((signal) => listCompanyFilterOptions(signal), [])

  // Chegada vinda do dashboard (?etapa=Proposta): a coluna é rolada e destacada, sem filtrar as outras.
  const [highlightStage] = useState<DealStage | null>(() => {
    const stage = readUrlState().pipelineStage as DealStage
    return ACTIVE_STAGES.includes(stage) ? stage : null
  })

  const [target, setTarget] = useState<DealDrawerTarget>(() => {
    if (newDealIntent) return { mode: "new", ...newDealIntent }
    const { dealId, dealSection } = readUrlState()
    return dealId ? { mode: "deal", id: dealId, section: dealSectionFromUrl(dealSection) } : null
  })
  const [taskStage, setTaskStage] = useState<DealStage | null>(null)
  const [closeRequest, setCloseRequest] = useState<CloseRequest | null>(null)

  function openDeal(dealId: string) {
    writeUrlState({ dealId, dealSection: "" })
    setTarget({ mode: "deal", id: dealId })
  }

  function closeDrawer() {
    writeUrlState({ dealId: null, dealSection: "" })
    setTarget(null)
  }

  const newDeal = (stage?: DealStage) => setTarget({ mode: "new", stage })

  const board = view.board
  const boardError = board.error !== null ? toMessage(board.error, "Não foi possível carregar o pipeline.") : null

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] flex-col max-md:pb-24 lg:min-h-svh">
      <div className="flex shrink-0 flex-col gap-5 px-4 pt-6 pb-4 sm:px-6 lg:px-10 lg:pt-10">
        <PipelineHeader
          view={view}
          onNewDeal={() => newDeal()}
          ownerPicker={
            canSeeOthers ? (
              <OwnerPicker
                value={view.owner}
                users={users.data ?? []}
                currentUserId={user.userId}
                onChange={view.setOwner}
                mineLabel="Meus negócios"
                className="w-full sm:w-auto sm:min-w-44"
              />
            ) : null
          }
        />

        <PipelineFilters
          filters={view.filters}
          sort={view.sort}
          segments={filterOptions.data?.segments ?? null}
          segmentsFailed={filterOptions.error !== null}
          activeCount={view.activeFilters}
          onChange={view.setFilters}
          onSort={view.setSort}
          onClear={view.clearFilters}
        />

        {/* PL3: KPIs (item 9) e funil (item 10) entram aqui, acima do quadro. */}

        {boardError && view.columns && (
          <Alert onRetry={() => board.reload()}>{boardError} O quadro mostra os dados anteriores.</Alert>
        )}
      </div>

      {/* O quadro tem altura própria: nunca empurra a página para rolar na horizontal. */}
      <section
        aria-label="Quadro"
        aria-busy={board.isLoading}
        className="flex h-[max(30rem,calc(100svh-17rem))] min-h-0 shrink-0 flex-col max-md:h-[max(28rem,calc(100svh-15rem))]"
      >
        {view.isFirstLoad ? (
          <BoardSkeleton />
        ) : boardError && !view.columns ? (
          <div className="px-4 sm:px-6 lg:px-10">
            <Alert onRetry={() => board.reload()}>{boardError}</Alert>
          </div>
        ) : view.columns ? (
          <div className={cn("flex min-h-0 flex-1 flex-col transition-opacity", view.isReloading && "opacity-60")}>
            <DealBoard
              view={view}
              highlightStage={highlightStage}
              onOpenDeal={(card) => openDeal(card.id)}
              onAddDeal={(stage) => newDeal(stage)}
              onAddTask={setTaskStage}
              onCloseRequest={(card, won) => setCloseRequest({ card, outcome: won ? "won" : "lost" })}
            />
          </div>
        ) : null}
      </section>

      {/* FAB do celular: o CTA do cabeçalho some abaixo de md. */}
      <button
        type="button"
        onClick={() => newDeal()}
        className="fixed right-4 bottom-4 z-40 inline-flex h-14 cursor-pointer items-center gap-2 rounded-full bg-accent px-5 font-medium text-on-accent shadow-panel transition-colors hover:bg-accent-hover focus-visible:focus-ring md:hidden"
      >
        <Plus className="size-5" aria-hidden="true" />
        Novo negócio
      </button>

      <CloseDealDialog
        target={
          closeRequest && {
            dealId: closeRequest.card.id,
            companyName: closeRequest.card.companyName,
            outcome: closeRequest.outcome,
            defaultAmount: closeRequest.card.value,
          }
        }
        onCancel={() => setCloseRequest(null)}
        onClosed={(deal) => {
          if (closeRequest) view.applyClosed(closeRequest.card, deal)
          setCloseRequest(null)
        }}
      />

      <NewTaskSheet
        open={taskStage !== null}
        onOpenChange={(open) => !open && setTaskStage(null)}
        canAssign={canSeeOthers}
        users={users.data ?? []}
        currentUserId={user.userId}
        stageFilter={taskStage ?? undefined}
        onCreated={() => {
          setTaskStage(null)
          view.toasts.show({ message: "Tarefa criada." })
          view.revalidate()
        }}
      />

      <DealDrawer
        target={target}
        users={users.data ?? []}
        onOpenChange={(open) => {
          if (!open) closeDrawer()
        }}
        onOpenCompany={onOpenCompany}
        onSaved={view.revalidate}
      />

      <Toaster toasts={view.toasts.toasts} onDismiss={view.toasts.dismiss} />
    </div>
  )
}

function BoardSkeleton() {
  return (
    <div role="status" className="flex min-h-0 flex-1 gap-3 overflow-hidden px-4 pb-4 sm:px-6 lg:px-10">
      <span className="sr-only">Carregando pipeline…</span>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex w-68 shrink-0 flex-col gap-2 rounded-sm border border-line-soft bg-sunken/60 p-3 max-md:w-full max-md:not-first:hidden">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mb-2 h-2.5 w-32" />
          {Array.from({ length: 4 - (i % 3) }, (_, j) => (
            <Skeleton key={j} className="h-24 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}
