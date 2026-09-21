import { useEffect, useRef, useState } from "react"
import { Plus } from "lucide-react"

import { OwnerPicker } from "@/components/OwnerPicker"
import { ShortcutsHelp } from "@/components/ShortcutsHelp"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Alert, Skeleton } from "@/components/ui/states"
import { Toaster } from "@/components/ui/toast"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LogActivityForm } from "@/features/activities/LogActivityForm"
import { toMessage } from "@/features/companies/form-errors"
import { listCompanyFilterOptions } from "@/features/companies/api"
import { ActivityFeedSheet } from "@/features/dashboard/ActivityFeedSheet"
import { NewTaskSheet } from "@/features/tasks/NewTaskSheet"
import type { AuthenticatedUser } from "@/lib/auth"
import { useAsyncResource, useMediaQuery } from "@/lib/hooks"
import { shortcutKey, type ShortcutHelpItem } from "@/lib/shortcuts"
import { readUrlState, writeUrlState } from "@/lib/url-state"
import { cn } from "@/lib/utils"
import { CloseDealDialog } from "./CloseDealForm"
import type { CloseOutcome } from "./close-deal"
import type { ColumnKey } from "./board-state"
import { DealBoard } from "./DealBoard"
import { DealDrawer, type DealDrawerTarget } from "./DealDrawer"
import { dealSectionFromUrl } from "./deal-section"
import { listUsers, type DealBoardCard, type DealStage, type UserSummary } from "./api"
import { PipelineActivities } from "./PipelineActivities"
import { PipelineEvolutionChart } from "./PipelineEvolutionChart"
import { PipelineFilters, PipelineHeader } from "./PipelineToolbar"
import { PipelineFunnel } from "./PipelineFunnel"
import { PipelineInsightsCards } from "./PipelineInsightsCards"
import { PipelineKpis } from "./PipelineKpis"
import { readHiddenKpis, writeHiddenKpis } from "./hidden-kpis"
import type { KpiId } from "./pipeline-metrics"
import { parsePipelineList, serializePipelineList, type PipelineListTarget } from "./pipeline-url"
import { StageListSheet } from "./StageListSheet"
import { ACTIVE_STAGES, stageLabels } from "./stage-labels"
import { ACTIVITY_COUNT, useDealBoard } from "./useDealBoard"

type Props = {
  user: AuthenticatedUser
  onOpenCompany: (companyId: string) => void
  newDealIntent?: { companyId: string; companyName: string } | null
}

/** A folha do `?` (item 22). As setas, o Enter e o Espaço valem com o foco num cartão. */
const PIPELINE_SHORTCUTS: ShortcutHelpItem[] = [
  { keys: ["N"], label: "Novo negócio" },
  { keys: ["/"], label: "Buscar no quadro" },
  { keys: ["F"], label: "Abrir os filtros" },
  { keys: ["↑", "↓", "←", "→"], label: "Andar entre os cartões" },
  { keys: ["Enter"], label: "Abrir o negócio" },
  { keys: ["Espaço"], label: "Pegar e soltar o cartão" },
  { keys: ["M"], label: "Mover o cartão para…" },
  { keys: ["Esc"], label: "Fechar ou cancelar" },
  { keys: ["?"], label: "Mostrar os atalhos" },
]

type CloseRequest = { card: DealBoardCard; outcome: CloseOutcome }

const listTargetOf = (key: ColumnKey): PipelineListTarget =>
  key === "won" || key === "lost" ? { kind: "closed", group: key } : { kind: "stage", stage: key }

/**
 * Pipeline Comercial: cabeçalho, KPIs, funil, filtros, o quadro com arrastar e soltar e a faixa
 * inferior (insights, evolução e atividades). O quadro tem altura própria e rola dentro dela; a
 * página rola na vertical em volta — nunca na horizontal.
 */
export function PipelinePage({ user, onOpenCompany, newDealIntent }: Props) {
  const canSeeOthers = user.role === "Admin" || user.role === "Closer"
  const view = useDealBoard(canSeeOthers, user.userId)
  const users = useAsyncResource((signal) => listUsers(signal), [])
  const filterOptions = useAsyncResource((signal) => listCompanyFilterOptions(signal), [])
  const isMobile = useMediaQuery("(max-width: 767px)")

  const boardRef = useRef<HTMLElement>(null)
  const funnelRef = useRef<HTMLDivElement>(null)

  // Chegada vinda do dashboard (?etapa=Proposta): a coluna é rolada e destacada, sem filtrar as outras.
  const [highlightStage, setHighlightStage] = useState<DealStage | null>(() => {
    const stage = readUrlState().pipelineStage as DealStage
    return ACTIVE_STAGES.includes(stage) ? stage : null
  })

  const [target, setTarget] = useState<DealDrawerTarget>(() => {
    if (newDealIntent) return { mode: "new", ...newDealIntent }
    const { dealId, dealSection } = readUrlState()
    return dealId ? { mode: "deal", id: dealId, section: dealSectionFromUrl(dealSection) } : null
  })
  const [taskStage, setTaskStage] = useState<DealStage | null>(null)
  const [taskDeal, setTaskDeal] = useState<DealBoardCard | null>(null)
  const [logTarget, setLogTarget] = useState<DealBoardCard | null>(null)
  const [reassignTarget, setReassignTarget] = useState<DealBoardCard | null>(null)
  const [closeRequest, setCloseRequest] = useState<CloseRequest | null>(null)
  const [feedOpen, setFeedOpen] = useState(false)
  const [listTarget, setListTarget] = useState<PipelineListTarget | null>(() => parsePipelineList(readUrlState().pipelineList))
  const [hiddenKpis, setHiddenKpis] = useState<KpiId[]>(() => readHiddenKpis())
  const [helpOpen, setHelpOpen] = useState(false)
  const [moveRequestId, setMoveRequestId] = useState<string | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const filtersRef = useRef<HTMLButtonElement>(null)

  /**
   * Atalhos da tela (item 22). Só valem com o foco na própria página (nada de diálogo, folha ou menu
   * aberto por cima) e fora de campo de texto; nenhum deles mexe na URL. O Esc é dos componentes:
   * cada camada (diálogo → folha → popover) fecha a de cima primeiro.
   */
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const key = shortcutKey(event)
      if (!key) return
      const target = event.target as Node
      if (target !== document.body && !pageRef.current?.contains(target)) return
      // Camada aberta — ou ainda saindo: um popover na animação de fechamento devolve o foco ao
      // gatilho depois, e isso fecharia na hora a ficha que o atalho acabou de abrir.
      if (document.querySelector('[role="dialog"][data-state], [role="menu"][data-state]')) return

      if (key === "n") newDeal()
      else if (key === "/") searchRef.current?.focus()
      else if (key === "f") filtersRef.current?.click()
      else if (key === "?") setHelpOpen((open) => !open)
      else if (key === "m") {
        const card = document.activeElement?.closest<HTMLElement>('[data-deal-card][data-status="Aberto"]')
        if (!card?.dataset.dealId) return
        setMoveRequestId(card.dataset.dealId)
      } else return
      event.preventDefault()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  function openDeal(dealId: string) {
    writeUrlState({ dealId, dealSection: "" })
    setTarget({ mode: "deal", id: dealId })
  }

  function closeDrawer() {
    writeUrlState({ dealId: null, dealSection: "" })
    setTarget(null)
  }

  const newDeal = (stage?: DealStage) => setTarget({ mode: "new", stage })

  /** O `×` e o "Restaurar cards" gravam a preferência; sem armazenamento, ela vale só nesta sessão. */
  function updateHidden(next: KpiId[]) {
    setHiddenKpis(next)
    writeHiddenKpis(next)
  }

  function openList(target: PipelineListTarget | null) {
    setListTarget(target)
    writeUrlState({ pipelineList: serializePipelineList(target) })
  }

  /**
   * Chegada por `?etapa=` (do dashboard ou do funil): a página desce até o quadro. Com os KPIs e o
   * funil acima dele, sem isso o quadro nasceria abaixo da dobra.
   */
  useEffect(() => {
    if (!highlightStage || !view.columns) return
    boardRef.current?.scrollIntoView({ block: "start" })
    // Só na primeira vez que o quadro existe: rolar de novo atropelaria quem já está lendo a página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.columns !== null])

  /** Clique no funil ou nos insights: leva o quadro até a coluna e a destaca de novo. */
  function goToStage(stage: DealStage) {
    setHighlightStage(null)
    window.requestAnimationFrame(() => {
      setHighlightStage(stage)
      boardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  const board = view.board
  const boardError = board.error !== null ? toMessage(board.error, "Não foi possível carregar o pipeline.") : null
  const errorOf = (resource: { error: unknown }, fallback: string) =>
    resource.error !== null ? toMessage(resource.error, fallback) : null

  return (
    <TooltipProvider>
      <div ref={pageRef} className="flex flex-col pb-10 max-md:pb-24">
        <div className="flex shrink-0 flex-col gap-5 px-4 pt-6 pb-4 sm:px-6 lg:px-10 lg:pt-10">
          <PipelineHeader
            view={view}
            onNewDeal={() => newDeal()}
            shortcuts={<ShortcutsHelp shortcuts={PIPELINE_SHORTCUTS} open={helpOpen} onOpenChange={setHelpOpen} />}
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

          <PipelineKpis
            summary={view.summary.data}
            isLoading={view.summary.isLoading}
            hidden={hiddenKpis}
            compact={isMobile}
            onHide={(id) => updateHidden([...hiddenKpis, id])}
            onRestore={() => updateHidden([])}
            onOpenBoard={() =>
              boardRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
            onOpenFunnel={() =>
              funnelRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              })
            }
          />

          <div ref={funnelRef}>
            <PipelineFunnel
              summary={view.summary.data}
              isLoading={view.summary.isLoading}
              periodLabel={view.periodLabel}
              onOpenStage={goToStage}
            />
          </div>

          <PipelineFilters
            searchRef={searchRef}
            filtersRef={filtersRef}
            filters={view.filters}
            sort={view.sort}
            segments={filterOptions.data?.segments ?? null}
            segmentsFailed={filterOptions.error !== null}
            activeCount={view.activeFilters}
            onChange={view.setFilters}
            onSort={view.setSort}
            onClear={view.clearFilters}
          />

          {/* O recorte de parados vem dos insights e sai daqui — ele muda o que o quadro mostra. */}
          {view.stalledOnly && (
            <div className="flex items-center gap-2">
              <Badge variant="accent" dot>
                Só negócios parados
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => view.setStalledOnly(false)}>
                Mostrar todos
              </Button>
            </div>
          )}

          {boardError && view.columns && (
            <Alert onRetry={() => board.reload()}>{boardError} O quadro mostra os dados anteriores.</Alert>
          )}
        </div>

        {/* O quadro tem altura própria: nunca empurra a página para rolar na horizontal. */}
        <section
          ref={boardRef}
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
                onSeeAll={(key) => openList(listTargetOf(key))}
                moveRequestId={moveRequestId}
                onMoveRequestDone={() => setMoveRequestId(null)}
                cardMenu={(card) => ({
                  onLogActivity: () => setLogTarget(card),
                  onNewTask: () => setTaskDeal(card),
                  onClose: (won) => setCloseRequest({ card, outcome: won ? "won" : "lost" }),
                  onReassign: () => setReassignTarget(card),
                  onOpenCompany: () => onOpenCompany(card.companyId),
                  canReassign: canSeeOthers,
                })}
              />
            </div>
          ) : null}
        </section>

        {/* Faixa inferior: 3 colunas em xl+, empilhada abaixo disso. */}
        <div className="grid gap-4 px-4 pt-6 sm:px-6 lg:px-10 xl:grid-cols-3">
          <PipelineInsightsCards
            insights={view.insights.data}
            isLoading={view.insights.isLoading}
            error={errorOf(view.insights, "Não foi possível carregar os insights.")}
            onRetry={() => view.insights.reload()}
            onOpenStage={goToStage}
            onOpenStalled={() => view.setStalledOnly(true)}
          />
          <PipelineEvolutionChart
            evolution={view.evolution.data}
            isLoading={view.evolution.isLoading}
            error={errorOf(view.evolution, "Não foi possível carregar a evolução.")}
            months={view.months}
            onMonths={view.setMonths}
            onRetry={() => view.evolution.reload()}
          />
          <PipelineActivities
            events={view.activities.data?.items.slice(0, ACTIVITY_COUNT) ?? null}
            isLoading={view.activities.isLoading}
            error={errorOf(view.activities, "Não foi possível carregar as atividades.")}
            onRetry={() => view.activities.reload()}
            onOpenDeal={openDeal}
            onSeeAll={() => setFeedOpen(true)}
          />
        </div>

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

        {/* Registrar atividade: o mesmo formulário do dashboard e de Tarefas. Só o cartão é revalidado. */}
        <Sheet open={logTarget !== null} onOpenChange={(open) => !open && setLogTarget(null)}>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Registrar atividade</SheetTitle>
              <SheetDescription>{logTarget ? logTarget.companyName : ""}</SheetDescription>
            </SheetHeader>
            <SheetBody className="p-6">
              {logTarget && (
                <LogActivityForm
                  key={logTarget.id}
                  dealId={logTarget.id}
                  contacts={[]}
                  onLogged={() => {
                    const id = logTarget.id
                    setLogTarget(null)
                    view.toasts.show({ message: "Atividade registrada." })
                    void view.revalidateCard(id)
                  }}
                />
              )}
            </SheetBody>
          </SheetContent>
        </Sheet>

        <NewTaskSheet
          open={taskStage !== null || taskDeal !== null}
          onOpenChange={(open) => {
            if (!open) {
              setTaskStage(null)
              setTaskDeal(null)
            }
          }}
          canAssign={canSeeOthers}
          users={users.data ?? []}
          currentUserId={user.userId}
          stageFilter={taskStage ?? undefined}
          initialDeal={
            taskDeal && {
              id: taskDeal.id,
              companyName: taskDeal.companyName,
              stage: taskDeal.stage,
              ownerUserName: taskDeal.ownerUserName,
            }
          }
          onCreated={() => {
            const id = taskDeal?.id
            setTaskStage(null)
            setTaskDeal(null)
            view.toasts.show({ message: "Tarefa criada." })
            // Tarefa num negócio do quadro: só aquele cartão muda ("próxima tarefa").
            if (id) void view.revalidateCard(id)
            else view.revalidate()
          }}
        />

        <ReassignDialog
          card={reassignTarget}
          users={users.data ?? []}
          onCancel={() => setReassignTarget(null)}
          onConfirm={(owner) => {
            const card = reassignTarget
            setReassignTarget(null)
            if (card) void view.reassignDeal(card, owner.id, owner.name)
          }}
        />

        <StageListSheet
          target={listTarget}
          params={view.params}
          onOpenChange={(open) => !open && openList(null)}
          onOpenDeal={(dealId) => {
            openList(null)
            openDeal(dealId)
          }}
        />

        <ActivityFeedSheet
          key={feedOpen ? "open" : "closed"}
          open={feedOpen}
          role={user.role}
          today={view.today}
          onOpenChange={setFeedOpen}
          onOpenDeal={openDeal}
        />

        <DealDrawer
          target={target}
          users={users.data ?? []}
          onOpenChange={(open) => {
            if (!open) closeDrawer()
          }}
          onOpenCompany={onOpenCompany}
          onSaved={view.revalidate}
          onTouched={view.markOwn}
          canReassign={canSeeOthers}
        />

        <p className="sr-only" aria-live="polite">
          {view.realtimeAnnouncement}
        </p>

        <Toaster toasts={view.toasts.toasts} onDismiss={view.toasts.dismiss} />
      </div>
    </TooltipProvider>
  )
}

/** Reatribuir (item 15): escolher o novo responsável entre os usuários da organização. */
function ReassignDialog({
  card,
  users,
  onCancel,
  onConfirm,
}: {
  card: DealBoardCard | null
  users: UserSummary[]
  onCancel: () => void
  onConfirm: (owner: UserSummary) => void
}) {
  return (
    <Sheet open={card !== null} onOpenChange={(open) => !open && onCancel()}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Reatribuir responsável</SheetTitle>
          <SheetDescription>
            {card ? `${card.companyName} · ${stageLabels[card.stage]}. Hoje com ${card.ownerUserName}.` : ""}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="p-6">
          <ul className="flex flex-col gap-1" aria-label="Responsáveis">
            {users.map((owner) => (
              <li key={owner.id}>
                <button
                  type="button"
                  disabled={owner.id === card?.ownerUserId}
                  onClick={() => onConfirm(owner)}
                  className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-3 text-left text-sm text-fg transition-colors hover:bg-surface-3 focus-visible:focus-ring disabled:cursor-default disabled:text-muted"
                >
                  {owner.name}
                  {owner.id === card?.ownerUserId && <span className="text-xs text-faint">atual</span>}
                </button>
              </li>
            ))}
          </ul>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

function BoardSkeleton() {
  return (
    <div role="status" className="flex min-h-0 flex-1 gap-3 overflow-hidden px-4 pb-4 sm:px-6 lg:px-10">
      <span className="sr-only">Carregando pipeline…</span>
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="flex w-68 shrink-0 flex-col gap-2 rounded-sm border border-line-soft bg-sunken/60 p-3 max-md:w-full max-md:not-first:hidden"
        >
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
