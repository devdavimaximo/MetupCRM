import { ArrowDown, ArrowUp, ArrowUpDown, Ban, CircleAlert, CircleCheck, Clock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Monogram } from "@/components/ui/monogram"
import { Hint } from "@/components/ui/tooltip"
import { activityTypeIcons } from "@/features/activities/activity-icons"
import { activityTypeLabels } from "@/features/activities/activity-labels"
import { stageLabels } from "@/features/deals/stage-labels"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { TaskItem, TaskSort } from "./api"
import { TaskActions, type TaskActionsContext } from "./TaskActions"
import { formatOverdueSince, formatTaskDue, isTaskOverdue, shortName } from "./task-format"
import { taskTitle } from "./task-labels"

export type TaskRowProps = {
  task: TaskItem
  now: Date
  showOwner: boolean
  selected: boolean
  /** Saiu do recorte depois de uma ação: esmaece antes de a página ser recarregada. */
  leaving: boolean
  highlighted: boolean
  /** `shift`: Shift+clique seleciona o intervalo desde a última caixa clicada. */
  onToggleSelected: (id: string, shift: boolean) => void
  actions: TaskActionsContext
}

/* ─── Células compartilhadas (tabela e card) ─────────────────────────────── */

function TaskTypeSquare({ task }: { task: TaskItem }) {
  const Icon = activityTypeIcons[task.type]
  return (
    <span
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-2 text-fg-muted"
      aria-hidden="true"
    >
      <Icon className="size-4" />
    </span>
  )
}

function TaskSummary({ task }: { task: TaskItem }) {
  const done = task.status !== "Pendente"
  const description = task.note ?? task.contactName
  return (
    <div className="flex min-w-0 items-center gap-3">
      <TaskTypeSquare task={task} />
      <div className="min-w-0">
        <p className={cn("truncate text-sm font-medium", done ? "text-muted line-through decoration-line-strong" : "text-fg")}>
          <span className="sr-only">{activityTypeLabels[task.type]}: </span>
          {taskTitle(task)}
        </p>
        {description && <p className="truncate text-xs text-muted">{description}</p>}
      </div>
    </div>
  )
}

function DealCell({ task, onOpenDeal }: { task: TaskItem; onOpenDeal: (task: TaskItem) => void }) {
  return (
    <div className="flex min-w-0 flex-col items-start">
      <button
        type="button"
        onClick={() => onOpenDeal(task)}
        className="max-w-full cursor-pointer truncate rounded-xs text-left text-sm text-fg decoration-line-strong underline-offset-4 hover:underline focus-visible:focus-ring"
      >
        {task.companyName}
      </button>
      <p className="flex max-w-full min-w-0 items-center gap-1.5 text-xs text-muted">
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent/80" />
        <span className="truncate">{stageLabels[task.dealStage]}</span>
        {task.dealAmount !== null && (
          <>
            <span aria-hidden="true">·</span>
            <span className="shrink-0 tabular">{formatMoney(task.dealAmount)}</span>
            {task.dealAmountIsEstimated && (
              <Hint content="Valor estimado pelo ticket do negócio — ainda não há valor em negociação.">
                <span tabIndex={0} className="shrink-0 rounded-xs text-2xs text-faint focus-visible:focus-ring">
                  est.
                </span>
              </Hint>
            )}
          </>
        )}
      </p>
    </div>
  )
}

function DueCell({ task, now }: { task: TaskItem; now: Date }) {
  const overdue = isTaskOverdue(task, now)
  const Icon = task.status === "Concluida" ? CircleCheck : task.status === "Cancelada" ? Ban : overdue ? CircleAlert : Clock
  const label = formatTaskDue(task.dueDate, now)
  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xs text-sm whitespace-nowrap tabular",
        overdue ? "text-danger" : task.status === "Pendente" ? "text-fg-muted" : "text-muted"
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
      {overdue && <span className="sr-only">, atrasada {formatOverdueSince(task.dueDate, now)}</span>}
    </span>
  )

  if (!overdue) return content
  return (
    <Hint content={`Atrasada ${formatOverdueSince(task.dueDate, now)}`} openOnTap>
      <span tabIndex={0} className="rounded-xs focus-visible:focus-ring">
        {content}
      </span>
    </Hint>
  )
}

export function TaskStatusBadge({ task, now }: { task: TaskItem; now: Date }) {
  if (task.status === "Concluida") return <Badge variant="success">Concluída</Badge>
  if (task.status === "Cancelada") return <Badge variant="outline">Cancelada</Badge>
  if (isTaskOverdue(task, now))
    return (
      <Badge variant="danger" dot>
        Atrasada
      </Badge>
    )
  return <Badge variant="accent">Pendente</Badge>
}

function OwnerCell({ name }: { name: string }) {
  return (
    <>
      <Hint content={name}>
        <span tabIndex={0} className="inline-flex rounded-sm focus-visible:focus-ring 2xl:hidden">
          <Monogram name={name} size="xs" />
          <span className="sr-only">{name}</span>
        </span>
      </Hint>
      <span className="hidden min-w-0 items-center gap-2 2xl:flex">
        <Monogram name={name} size="xs" />
        <span className="truncate text-sm text-fg-muted">{shortName(name)}</span>
      </span>
    </>
  )
}

function SelectBox({
  label,
  checked,
  indeterminate,
  onChange,
}: {
  label: string
  checked: boolean
  indeterminate?: boolean
  onChange: (shift: boolean) => void
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = Boolean(indeterminate)
      }}
      // O change não diz se o Shift estava pressionado; o clique diz (teclado = Espaço, sem Shift).
      onClick={(event) => onChange(event.shiftKey)}
      onChange={() => undefined}
      className="size-4 cursor-pointer rounded-xs accent-accent focus-visible:focus-ring"
    />
  )
}

/* ─── Tabela (≥ 768px) ───────────────────────────────────────────────────── */

type SortKey = "Owner" | "Due" | "Status"

function SortHeader({
  label,
  shortLabel,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string
  /** Abaixo de 2xl, onde a coluna encolhe (Responsável vira só avatar). */
  shortLabel?: string
  sortKey: SortKey
  sort: TaskSort
  onSort: (sort: TaskSort) => void
  className?: string
}) {
  const active = sortKey === "Due" ? sort === "DueAsc" || sort === "DueDesc" : sort === sortKey
  const direction = !active ? "none" : sort === "DueDesc" ? "descending" : "ascending"
  const Icon = !active ? ArrowUpDown : direction === "descending" ? ArrowDown : ArrowUp
  const next: TaskSort = sortKey === "Due" ? (sort === "DueAsc" ? "DueDesc" : "DueAsc") : sortKey

  return (
    <th
      scope="col"
      aria-sort={direction}
      className={cn("label-mono h-10 px-3 text-left align-middle font-medium whitespace-nowrap text-muted", className)}
    >
      <button
        type="button"
        onClick={() => onSort(next)}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 rounded-xs uppercase transition-colors hover:text-fg focus-visible:focus-ring",
          active && "text-fg"
        )}
      >
        {shortLabel ? (
          <>
            <span aria-hidden="true" className="2xl:hidden">{shortLabel}</span>
            <span className="max-2xl:sr-only">{label}</span>
          </>
        ) : (
          label
        )}
        <Icon className="size-3" aria-hidden="true" />
      </button>
    </th>
  )
}

export function TaskTable({
  tasks,
  sort,
  onSort,
  selectedIds,
  onToggleAll,
  ...rowProps
}: Omit<TaskRowProps, "task" | "selected" | "leaving" | "highlighted"> & {
  tasks: TaskItem[]
  sort: TaskSort
  onSort: (sort: TaskSort) => void
  selectedIds: ReadonlySet<string>
  onToggleAll: () => void
  leavingIds: Set<string>
  highlightId: string | null
}) {
  const { leavingIds, highlightId, ...shared } = rowProps
  const selectedOnPage = tasks.filter((t) => selectedIds.has(t.id)).length
  const allSelected = tasks.length > 0 && selectedOnPage === tasks.length

  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <caption className="sr-only">Tarefas</caption>
      <colgroup>
        <col className="w-11" />
        <col />
        <col className="w-52 2xl:w-64" />
        {shared.showOwner && <col className="w-20 2xl:w-48" />}
        <col className="w-36" />
        <col className="w-28" />
        <col className="w-40" />
      </colgroup>
      <thead className="border-b border-line-soft">
        <tr>
          <th scope="col" className="h-10 pl-5 text-left align-middle">
            <SelectBox
              label="Selecionar todas as tarefas da página"
              checked={allSelected}
              indeterminate={selectedOnPage > 0 && !allSelected}
              onChange={() => onToggleAll()}
            />
          </th>
          <th scope="col" className="label-mono h-10 px-3 text-left align-middle font-medium text-muted">
            Tarefa
          </th>
          <th scope="col" className="label-mono h-10 px-3 text-left align-middle font-medium text-muted">
            Cliente / Negócio
          </th>
          {shared.showOwner && <SortHeader label="Responsável" shortLabel="Resp." sortKey="Owner" sort={sort} onSort={onSort} />}
          <SortHeader label="Prazo" sortKey="Due" sort={sort} onSort={onSort} />
          <SortHeader label="Status" sortKey="Status" sort={sort} onSort={onSort} />
          <th scope="col" className="h-10 pr-5">
            <span className="sr-only">Ações</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line-soft/70">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            selected={selectedIds.has(task.id)}
            leaving={leavingIds.has(task.id)}
            highlighted={task.id === highlightId}
            {...shared}
          />
        ))}
      </tbody>
    </table>
  )
}

export function TaskRow({ task, now, showOwner, selected, leaving, highlighted, onToggleSelected, actions }: TaskRowProps) {
  return (
    <tr
      data-task-id={task.id}
      className={cn(
        "transition-[opacity,background-color] duration-200 hover:bg-surface-2/60 focus-within:bg-surface-2/60",
        selected && "bg-accent/5",
        leaving && "opacity-0",
        highlighted && "animate-row-highlight"
      )}
    >
      <td className="h-16 pl-5 align-middle">
        <SelectBox label={`Selecionar: ${taskTitle(task)}`} checked={selected} onChange={(shift) => onToggleSelected(task.id, shift)} />
      </td>
      <td className="px-3 align-middle">
        <TaskSummary task={task} />
      </td>
      <td className="px-3 align-middle">
        <DealCell task={task} onOpenDeal={actions.onOpenDeal} />
      </td>
      {showOwner && (
        <td className="px-3 align-middle">
          <OwnerCell name={task.ownerUserName} />
        </td>
      )}
      <td className="px-3 align-middle">
        <DueCell task={task} now={now} />
      </td>
      <td className="px-3 align-middle">
        <TaskStatusBadge task={task} now={now} />
      </td>
      <td className="pr-5 pl-3 align-middle">
        <TaskActions task={task} {...actions} />
      </td>
    </tr>
  )
}

/* ─── Cards (< 768px) ────────────────────────────────────────────────────── */

export function TaskCards({
  tasks,
  selectedIds,
  leavingIds,
  highlightId,
  ...shared
}: Omit<TaskRowProps, "task" | "selected" | "leaving" | "highlighted"> & {
  tasks: TaskItem[]
  selectedIds: ReadonlySet<string>
  leavingIds: Set<string>
  highlightId: string | null
}) {
  return (
    <ul className="flex flex-col divide-y divide-line-soft/70" aria-label="Tarefas">
      {tasks.map((task) => (
        <li
          key={task.id}
          data-task-id={task.id}
          className={cn(
            "flex flex-col gap-3 px-4 py-3.5 transition-[opacity,background-color] duration-200",
            selectedIds.has(task.id) && "bg-accent/5",
            leavingIds.has(task.id) && "opacity-0",
            task.id === highlightId && "animate-row-highlight"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="pt-2.5">
              <SelectBox
                label={`Selecionar: ${taskTitle(task)}`}
                checked={selectedIds.has(task.id)}
                onChange={(shift) => shared.onToggleSelected(task.id, shift)}
              />
            </div>
            <div className="min-w-0 flex-1">
              <TaskSummary task={task} />
            </div>
            <TaskActions task={task} {...shared.actions} compact />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 pl-7">
            <DealCell task={task} onOpenDeal={shared.actions.onOpenDeal} />
            <div className="flex items-center gap-2">
              <DueCell task={task} now={shared.now} />
              <TaskStatusBadge task={task} now={shared.now} />
            </div>
          </div>
          {shared.showOwner && (
            <p className="flex items-center gap-2 pl-7 text-xs text-muted">
              <Monogram name={task.ownerUserName} size="xs" />
              {shortName(task.ownerUserName)}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
