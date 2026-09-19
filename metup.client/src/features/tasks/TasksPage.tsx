import { useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { CalendarClock, CalendarDays, CheckCheck, CircleAlert, Plus, SearchX, Sun, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Page } from "@/components/ui/page"
import { Alert, EmptyState, Skeleton, SkeletonRows } from "@/components/ui/states"
import { Hint, TooltipProvider } from "@/components/ui/tooltip"
import { toMessage } from "@/features/companies/form-errors"
import { KpiCard, Panel } from "@/features/dashboard/dashboard-cards"
import { countDelta } from "@/features/dashboard/dashboard-format"
import { DealDrawer, type DealDrawerTarget } from "@/features/deals/DealDrawer"
import { listUsers } from "@/features/deals/api"
import type { AuthenticatedUser } from "@/lib/auth"
import { useAsyncResource, useMediaQuery } from "@/lib/hooks"
import { addDays, todayLocal } from "@/lib/local-date"
import { numberFormatter } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { LogActivityForm } from "@/features/activities/LogActivityForm"
import { NewTaskSheet } from "./NewTaskSheet"
import { OwnerPicker } from "@/components/OwnerPicker"
import { TaskBulkBar } from "./TaskBulkBar"
import { TaskCalendar, TaskStatusCard, WeeklyHighlightsCard } from "./TaskSidebar"
import { TaskCards, TaskTable } from "./TaskTable"
import type { TaskActionsContext } from "./TaskActions"
import { TaskFiltersButton, TaskPagination, TaskSortMenu } from "./TaskToolbar"
import type { BulkTaskAction, BulkTaskResult, TaskItem, TaskScope, TaskSummary } from "./api"
import { bulkResultMessage, failureReasonLabels, type HighlightSubject } from "./task-insights"
import { TASK_TABS } from "./task-format"
import { taskTitle } from "./task-labels"
import { toggleSelection } from "./task-selection"
import { useTasksView } from "./useTasksView"

type Props = {
  user: AuthenticatedUser
  onOpenCompany: (companyId: string) => void
}

const tabLabels: Record<TaskScope, string> = {
  All: "Todas",
  Overdue: "Atrasadas",
  Today: "Hoje",
  ThisWeek: "Esta semana",
  Later: "Mais tarde",
}

const countKey: Record<TaskScope, keyof TaskSummary["counts"]> = {
  All: "all",
  Overdue: "overdue",
  Today: "today",
  ThisWeek: "thisWeek",
  Later: "later",
}

const emptyByTab: Record<TaskScope, { title: string; description: string }> = {
  All: { title: "Nenhuma tarefa por aqui", description: "Crie uma tarefa ou registre uma atividade com próxima ação." },
  Overdue: { title: "Nada atrasado. Fila em dia.", description: "Todo follow-up vencido já foi feito ou reagendado." },
  Today: { title: "Nada para hoje", description: "Nenhuma tarefa vence neste dia. Veja o que vem na semana." },
  ThisWeek: { title: "Semana livre", description: "Nenhuma tarefa vence até domingo além das de hoje." },
  Later: { title: "Nada mais adiante", description: "Nenhuma tarefa marcada para depois desta semana." },
}

/** Tempo da transição da linha que sai do recorte, antes de a página ser recarregada. */
const LEAVE_MS = 200

const EMPTY_SELECTION: ReadonlySet<string> = new Set()

/**
 * A tela de Tarefas: "o que temos para fazer" com recortes de prazo calculados no servidor, KPIs
 * contra a semana anterior, filtros, ordenação e paginação — e as ações na própria linha.
 */
export function TasksPage({ user, onOpenCompany }: Props) {
  const canSeeOthers = user.role === "Admin" || user.role === "Closer"
  const view = useTasksView(canSeeOthers)
  const isDesktop = useMediaQuery("(min-width: 768px)")

  const isWide = useMediaQuery("(min-width: 1536px)")

  const users = useAsyncResource((signal) => listUsers(signal), [])
  const [leavingIds, setLeavingIds] = useState<Set<string>>(() => new Set())
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [drawer, setDrawer] = useState<DealDrawerTarget>(null)
  const [logTarget, setLogTarget] = useState<TaskItem | null>(null)
  const [bulkOutcome, setBulkOutcome] = useState<{ message: string; failures: { title: string; reason: string }[] } | null>(null)
  const tableTopRef = useRef<HTMLDivElement>(null)
  const selectionAnchor = useRef<string | null>(null)

  // A seleção vale só para o recorte atual: trocar aba, página, filtro, data, responsável ou ordem a
  // esvazia. Guardada junto da chave do recorte, sem efeito para "limpar depois".
  const selectionScope = JSON.stringify([view.tab, view.page, view.pageSize, view.referenceDate, view.owner, view.filters, view.sort])
  const [selection, setSelection] = useState<{ scope: string; ids: Set<string> }>(() => ({ scope: selectionScope, ids: new Set() }))
  const selectedIds = selection.scope === selectionScope ? selection.ids : EMPTY_SELECTION

  function setSelectedIds(update: (ids: Set<string>) => Set<string>) {
    setSelection((current) => ({
      scope: selectionScope,
      ids: update(current.scope === selectionScope ? current.ids : new Set()),
    }))
  }

  const now = new Date()
  const today = todayLocal()
  const showOwner = canSeeOthers && view.owner.kind !== "mine"
  const listData = view.list.data
  const tasks = listData?.items ?? []
  const summary = view.summary.data
  const hasFilters = view.activeFilters > 0

  function changeTab(tab: TaskScope) {
    view.setTab(tab)
  }

  function changePage(page: number) {
    view.setPage(page)
    const top = tableTopRef.current
    if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: "start" })
  }

  /** A tarefa ainda pertence ao recorte? Fora de "Todas" só pendentes; em "Todas", o filtro de status manda. */
  function staysInView(updated: TaskItem, original: TaskItem) {
    if (updated.dueDate !== original.dueDate && view.tab !== "All") return false
    if (view.tab !== "All") return updated.status === "Pendente"
    return view.filters.statuses.length === 0 ? updated.status !== "Cancelada" : view.filters.statuses.includes(updated.status)
  }

  function handleChanged(updated: TaskItem) {
    const original = tasks.find((t) => t.id === updated.id)
    view.list.setData((current) =>
      current ? { ...current, items: current.items.map((t) => (t.id === updated.id ? updated : t)) } : current
    )

    if (!original || staysInView(updated, original)) {
      view.revalidate()
      return
    }

    setLeavingIds((ids) => new Set(ids).add(updated.id))
    setSelectedIds((ids) => {
      const next = new Set(ids)
      next.delete(updated.id)
      return next
    })
    setTimeout(() => {
      view.list.setData((current) =>
        current
          ? { ...current, items: current.items.filter((t) => t.id !== updated.id), totalCount: Math.max(0, current.totalCount - 1) }
          : current
      )
      setLeavingIds((ids) => {
        const next = new Set(ids)
        next.delete(updated.id)
        return next
      })
      view.revalidate()
    }, LEAVE_MS)
  }

  function handleCreated(task: TaskItem) {
    setIsCreating(false)
    setHighlightId(task.id)
    setAnnouncement(`Tarefa criada: ${taskTitle(task)}.`)
    view.revalidate()
  }

  function toggleSelected(id: string, shift: boolean) {
    const anchor = selectionAnchor.current
    selectionAnchor.current = id
    setSelectedIds((ids) =>
      toggleSelection(
        ids,
        tasks.map((t) => t.id),
        id,
        anchor,
        shift
      )
    )
  }

  /** Depois do lote: mensagem acessível, lista e resumo revalidados, e só as que falharam seguem marcadas. */
  function handleBulkDone(action: BulkTaskAction, result: BulkTaskResult) {
    const titleOf = (id: string) => {
      const task = tasks.find((t) => t.id === id)
      return task ? taskTitle(task) : "Tarefa"
    }
    setBulkOutcome({
      message: bulkResultMessage(action, result),
      failures: result.failed.map((f) => ({ title: titleOf(f.id), reason: failureReasonLabels[f.reason] })),
    })
    setSelectedIds(() => new Set(result.failed.map((f) => f.id)))
    view.revalidate()
  }

  function handleActivityLogged() {
    const task = logTarget
    setLogTarget(null)
    if (task) setAnnouncement(`Atividade registrada e tarefa concluída: ${taskTitle(task)}.`)
    view.revalidate()
  }

  const highlightSubject: HighlightSubject =
    !canSeeOthers || view.owner.kind === "mine"
      ? { kind: "self" }
      : view.owner.kind === "all"
        ? { kind: "team" }
        : (() => {
            const userId = view.owner.userId
            const name = users.data?.find((u) => u.id === userId)?.name
            return userId === user.userId ? { kind: "self" } : name ? { kind: "user", name } : { kind: "team" }
          })()

  function toggleAll() {
    setSelectedIds((ids) => {
      const allOnPage = tasks.length > 0 && tasks.every((t) => ids.has(t.id))
      const next = new Set(ids)
      for (const t of tasks) {
        if (allOnPage) next.delete(t.id)
        else next.add(t.id)
      }
      return next
    })
  }

  const openDeal = (task: TaskItem) => setDrawer({ mode: "deal", id: task.dealId })

  const actions: TaskActionsContext = {
    canReassign: canSeeOthers,
    users: users.data ?? [],
    onOpenDeal: openDeal,
    onLogActivity: setLogTarget,
    onChanged: handleChanged,
  }

  const rowProps = {
    now,
    showOwner,
    onToggleSelected: toggleSelected,
    actions,
    selectedIds,
    leavingIds,
    highlightId,
  }

  const firstLoad = view.list.isLoading && !listData
  const reloading = view.list.isLoading && listData !== null
  const empty = !view.list.isLoading && listData !== null && tasks.length === 0

  return (
    <TooltipProvider>
    <Page width="wide" className="gap-6">
      <TasksHeader
        referenceDate={view.referenceDate}
        onReferenceDate={view.setReferenceDate}
        today={today}
        ownerPicker={
          canSeeOthers ? (
            <OwnerPicker
              value={view.owner}
              users={users.data ?? []}
              currentUserId={user.userId}
              onChange={view.setOwner}
              className="w-full sm:w-auto sm:min-w-44"
            />
          ) : null
        }
        onNewTask={() => setIsCreating(true)}
      />

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-6">
      {/* KPIs */}
      <section aria-label="Resumo das tarefas" className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {view.summary.error && !summary ? (
          <Alert onRetry={() => view.summary.reload()} className="sm:col-span-3">
            {toMessage(view.summary.error, "Não foi possível carregar o resumo das tarefas.")} A lista abaixo continua valendo.
          </Alert>
        ) : !summary ? (
          [0, 1, 2].map((i) => (
            <Panel key={i} className="gap-3 px-4 py-3.5" aria-hidden="true">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-32" />
            </Panel>
          ))
        ) : (
          <>
            <KpiCard
              icon={CircleAlert}
              label="Atrasadas"
              tone="danger"
              value={numberFormatter.format(summary.counts.overdue)}
              delta={countDelta(summary.counts.overdue, summary.previous?.overdue ?? null)}
              polarity="higher-is-worse"
              comparison="a mesma régua 7 dias antes"
              caption="vs. semana anterior"
              pressed={view.tab === "Overdue"}
              onClick={() => changeTab("Overdue")}
            />
            <KpiCard
              icon={Sun}
              label="Hoje"
              value={numberFormatter.format(summary.counts.today)}
              delta={countDelta(summary.counts.today, summary.previous?.today ?? null)}
              polarity="neutral"
              comparison="o mesmo dia da semana anterior"
              caption="vs. semana anterior"
              pressed={view.tab === "Today"}
              onClick={() => changeTab("Today")}
            />
            <KpiCard
              icon={CalendarDays}
              label="Esta semana"
              value={numberFormatter.format(summary.counts.thisWeek)}
              delta={countDelta(summary.counts.thisWeek, summary.previous?.thisWeek ?? null)}
              polarity="neutral"
              comparison="a mesma régua 7 dias antes"
              caption="vs. semana anterior"
              pressed={view.tab === "ThisWeek"}
              onClick={() => changeTab("ThisWeek")}
            />
          </>
        )}
      </section>

      <div ref={tableTopRef} className="scroll-mt-20">
        <Panel aria-label="Lista de tarefas" className="overflow-clip">
          <div className="flex flex-col gap-3 border-b border-line-soft px-2 pt-2 lg:flex-row lg:items-end lg:justify-between lg:gap-4 lg:pr-4">
            <TaskTabs
              tab={view.tab}
              summary={summary}
              filteredCount={hasFilters ? (listData?.totalCount ?? null) : null}
              onChange={changeTab}
            />
            <div className="flex flex-wrap items-center gap-2 px-2 pb-2 lg:px-0">
              {hasFilters && (
                <Button type="button" size="sm" variant="ghost" className="h-9" onClick={view.clearFilters}>
                  <X aria-hidden="true" />
                  Limpar filtros
                </Button>
              )}
              <TaskFiltersButton
                tab={view.tab}
                filters={view.filters}
                activeCount={view.activeFilters}
                onChange={view.setFilters}
                onClear={view.clearFilters}
              />
              <TaskSortMenu value={view.sort} onChange={view.setSort} showOwner={showOwner} />
            </div>
          </div>

          <div id="tasks-panel" role="tabpanel" aria-labelledby={`tasks-tab-${view.tab}`} aria-busy={view.list.isLoading}>
            {view.list.error !== null && !listData ? (
              <div className="p-4">
                <Alert onRetry={() => view.list.reload()}>
                  {toMessage(view.list.error, "Não foi possível carregar as tarefas.")}
                </Alert>
              </div>
            ) : firstLoad ? (
              <SkeletonRows rows={6} label="Carregando tarefas…" />
            ) : empty ? (
              hasFilters ? (
                <EmptyState
                  icon={SearchX}
                  title="Nada com esses filtros"
                  description="Ajuste ou limpe os filtros para ver as tarefas desta aba."
                  action={
                    <Button type="button" size="sm" variant="outline" onClick={view.clearFilters}>
                      Limpar filtros
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={view.tab === "Overdue" ? CheckCheck : CalendarClock}
                  title={emptyByTab[view.tab].title}
                  description={emptyByTab[view.tab].description}
                />
              )
            ) : (
              <div className={cn("transition-opacity", reloading && "opacity-60")}>
                {view.list.error !== null && (
                  <div className="p-4 pb-0">
                    <Alert onRetry={() => view.list.reload()}>
                      {toMessage(view.list.error, "Não foi possível atualizar as tarefas.")}
                    </Alert>
                  </div>
                )}
                {isDesktop ? (
                  <TaskTable tasks={tasks} sort={view.sort} onSort={view.setSort} onToggleAll={toggleAll} {...rowProps} />
                ) : (
                  <TaskCards tasks={tasks} {...rowProps} />
                )}
              </div>
            )}
          </div>

          {bulkOutcome && (
            <div role="status" className="flex flex-col gap-1 border-t border-line-soft px-4 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-fg">{bulkOutcome.message}</p>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Fechar aviso" onClick={() => setBulkOutcome(null)}>
                  <X aria-hidden="true" />
                </Button>
              </div>
              {bulkOutcome.failures.length > 0 && (
                <details className="text-xs text-fg-muted">
                  <summary className="cursor-pointer rounded-xs text-fg-muted hover:text-fg focus-visible:focus-ring">Ver motivos</summary>
                  <ul className="mt-1 flex flex-col gap-0.5 pl-4">
                    {bulkOutcome.failures.map((f, i) => (
                      <li key={i} className="list-disc">
                        {f.title}: {f.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {selectedIds.size > 0 && (
            <TaskBulkBar
              ids={[...selectedIds]}
              canReassign={canSeeOthers}
              users={users.data ?? []}
              onDone={handleBulkDone}
              onClear={() => setSelectedIds(() => new Set())}
            />
          )}

          {listData && listData.totalCount > 0 && (
            <TaskPagination
              page={view.page}
              pageSize={view.pageSize}
              totalCount={listData.totalCount}
              totalPages={listData.totalPages}
              onPage={changePage}
              onPageSize={view.setPageSize}
            />
          )}
        </Panel>
      </div>
      </div>

      <aside aria-label="Calendário e resumo" className="grid grid-cols-1 content-start gap-4 md:grid-cols-2 2xl:grid-cols-1">
        <TaskCalendar
          referenceDate={view.referenceDate}
          owners={view.owners}
          onPick={view.pickDay}
          collapsible={!isWide}
        />
        <TaskStatusCard summary={view.summary} wide={isWide} onSelect={(slice) => view.showSlice(slice.target.tab, slice.target.statuses)} />
        <div className="md:col-span-2 2xl:col-span-1">
          <WeeklyHighlightsCard summary={view.summary} subject={highlightSubject} />
        </div>
      </aside>
      </div>

      <Sheet open={logTarget !== null} onOpenChange={(open) => !open && setLogTarget(null)}>
        <SheetContent size="md">
          <SheetHeader>
            <SheetTitle>Registrar atividade</SheetTitle>
            <SheetDescription>
              {logTarget ? `${taskTitle(logTarget)} · ${logTarget.companyName}. Ao salvar, a tarefa é concluída.` : ""}
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="p-6">
            {logTarget && (
              <LogActivityForm
                key={logTarget.id}
                dealId={logTarget.dealId}
                contacts={[]}
                initialType={logTarget.type}
                completesTaskId={logTarget.id}
                onLogged={handleActivityLogged}
              />
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>

      <NewTaskSheet
        open={isCreating}
        onOpenChange={setIsCreating}
        canAssign={canSeeOthers}
        users={users.data ?? []}
        currentUserId={user.userId}
        onCreated={handleCreated}
      />

      <DealDrawer
        target={drawer}
        users={users.data ?? []}
        onOpenChange={(open) => !open && setDrawer(null)}
        onOpenCompany={onOpenCompany}
        onSaved={view.revalidate}
      />
    </Page>
    </TooltipProvider>
  )
}

/* ─── Cabeçalho ───────────────────────────────────────────────────────────── */

function TasksHeader({
  referenceDate,
  onReferenceDate,
  today,
  ownerPicker,
  onNewTask,
}: {
  referenceDate: string
  onReferenceDate: (date: string) => void
  today: string
  ownerPicker: ReactNode
  onNewTask: () => void
}) {
  const newTask = (
    <Button type="button" onClick={onNewTask} className="h-10">
      <Plus aria-hidden="true" />
      Nova tarefa
    </Button>
  )

  return (
    <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <nav aria-label="Trilha de navegação">
          <ol className="label-mono flex items-center gap-2 text-muted">
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="h-px w-5 shrink-0 bg-accent" />
              Operação
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-accent">
              Tarefas
            </li>
          </ol>
        </nav>
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-fg">Tarefas</h1>
          <div className="md:hidden">{newTask}</div>
        </div>
        <p className="max-w-2xl text-base text-fg-muted">Organize sua rotina, mantenha o foco e não perca nenhuma oportunidade.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 max-md:*:flex-1 xl:shrink-0 xl:flex-nowrap">
        <DatePicker
          label="Data de referência"
          value={referenceDate}
          onChange={onReferenceDate}
          shortcuts={[
            { label: "Hoje", date: today },
            { label: "Amanhã", date: addDays(today, 1) },
          ]}
          className="min-w-0"
        />
        {ownerPicker}
        <div className="max-md:hidden">{newTask}</div>
      </div>
    </header>
  )
}

/* ─── Abas ────────────────────────────────────────────────────────────────── */

function TaskTabs({
  tab,
  summary,
  filteredCount,
  onChange,
}: {
  tab: TaskScope
  summary: TaskSummary | null
  /** Com filtro ativo: o total da lista, que vale só para a aba ativa. */
  filteredCount: number | null
  onChange: (tab: TaskScope) => void
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, (i: number) => number> = {
      ArrowRight: (i) => (i + 1) % TASK_TABS.length,
      ArrowLeft: (i) => (i - 1 + TASK_TABS.length) % TASK_TABS.length,
      Home: () => 0,
      End: () => TASK_TABS.length - 1,
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    const next = TASK_TABS[move(TASK_TABS.indexOf(tab))]
    onChange(next)
    event.currentTarget.querySelector<HTMLElement>(`#tasks-tab-${next}`)?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label="Recortes de prazo"
      onKeyDown={handleKeyDown}
      className="-mb-px flex overflow-x-auto scrollbar-none"
    >
      {TASK_TABS.map((scope) => {
        const active = scope === tab
        const unfiltered = summary ? summary.counts[countKey[scope]] : null
        const count = filteredCount !== null && active ? filteredCount : unfiltered
        const dimmed = filteredCount !== null && !active
        const danger = scope === "Overdue" && (unfiltered ?? 0) > 0

        const badge =
          count === null ? null : (
            <span
              className={cn(
                "rounded-xs px-1.5 py-px text-2xs tabular",
                danger && !dimmed ? "bg-danger/12 text-danger" : "bg-surface-3 text-fg-muted",
                dimmed && "opacity-50"
              )}
            >
              <span className="sr-only">{dimmed ? ", sem filtros: " : ": "}</span>
              {numberFormatter.format(count)}
            </span>
          )

        return (
          <button
            key={scope}
            id={`tasks-tab-${scope}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls="tasks-panel"
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(scope)}
            className={cn(
              "inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3.5 text-sm whitespace-nowrap transition-colors focus-visible:focus-ring",
              active ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg"
            )}
          >
            {tabLabels[scope]}
            {badge && dimmed ? (
              <Hint content="Contagem sem filtros">
                <span>{badge}</span>
              </Hint>
            ) : (
              badge
            )}
          </button>
        )
      })}
    </div>
  )
}
