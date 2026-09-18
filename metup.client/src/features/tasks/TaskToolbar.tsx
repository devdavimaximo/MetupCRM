import type { ReactNode } from "react"
import { ArrowDownUp, ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ToggleChips } from "@/components/ui/choice-chips"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { activityTypeIcons } from "@/features/activities/activity-icons"
import { activityTypeLabels, NEXT_ACTION_TYPES } from "@/features/activities/activity-labels"
import { ALL_STAGES, stageLabels } from "@/features/deals/stage-labels"
import { cn } from "@/lib/utils"
import type { TaskScope, TaskSort, TaskStatus } from "./api"
import { pageItems, PAGE_SIZES, rangeLabel, type PageSize } from "./task-format"
import { taskStatusLabels } from "./task-labels"
import type { TaskFilters } from "./useTasksView"

/* ─── Filtros ─────────────────────────────────────────────────────────────── */

const STATUS_OPTIONS: TaskStatus[] = ["Pendente", "Concluida", "Cancelada"]

function FilterGroup({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="label-mono mb-2 text-muted">{title}</legend>
      {children}
      {note && <p className="text-xs text-muted">{note}</p>}
    </fieldset>
  )
}

/**
 * Botão de filtros com a quantidade ativa e o popover: status (só na aba Todas — nas outras a lista é
 * sempre de pendentes), tipo, etapa do negócio e busca por empresa/nota.
 */
export function TaskFiltersButton({
  tab,
  filters,
  activeCount,
  onChange,
  onClear,
}: {
  tab: TaskScope
  filters: TaskFilters
  activeCount: number
  onChange: (filters: TaskFilters) => void
  onClear: () => void
}) {
  const statusOnlyInAll = tab !== "All"

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          aria-label={activeCount > 0 ? `Filtros (${activeCount} ativos)` : "Filtros"}
        >
          <SlidersHorizontal aria-hidden="true" />
          Filtros
          {activeCount > 0 && (
            <span className="inline-flex min-w-4.5 items-center justify-center rounded-full bg-accent px-1 text-2xs text-on-accent tabular">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Filtros das tarefas" align="end" className="flex w-[min(26rem,calc(100vw-1.5rem))] flex-col gap-5 p-4">
        <label className="flex items-center gap-2 rounded-sm border border-line-soft bg-surface px-3 focus-within:border-line-strong">
          <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
          <span className="sr-only">Buscar por empresa ou nota</span>
          <input
            type="search"
            value={filters.search}
            maxLength={100}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Empresa ou nota…"
            className="h-9 min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted"
          />
        </label>

        <FilterGroup title="Status" note={statusOnlyInAll ? "Só na aba Todas — as outras abas mostram pendentes." : undefined}>
          <ToggleChips
            label="Status"
            disabled={statusOnlyInAll}
            options={STATUS_OPTIONS.map((status) => ({ value: status, label: taskStatusLabels[status] }))}
            values={statusOnlyInAll ? [] : filters.statuses}
            onChange={(statuses) => onChange({ ...filters, statuses })}
          />
        </FilterGroup>

        <FilterGroup title="Tipo de atividade">
          <ToggleChips
            label="Tipo de atividade"
            options={NEXT_ACTION_TYPES.map((type) => ({ value: type, label: activityTypeLabels[type], icon: activityTypeIcons[type] }))}
            values={filters.types}
            onChange={(types) => onChange({ ...filters, types })}
          />
        </FilterGroup>

        <FilterGroup title="Etapa do negócio">
          <ToggleChips
            label="Etapa do negócio"
            options={ALL_STAGES.map((stage) => ({ value: stage, label: stageLabels[stage] }))}
            values={filters.stages}
            onChange={(stages) => onChange({ ...filters, stages })}
          />
        </FilterGroup>

        <div className="flex justify-end border-t border-line-soft pt-3">
          <Button type="button" size="sm" variant="ghost" disabled={activeCount === 0} onClick={onClear}>
            <X aria-hidden="true" />
            Limpar filtros
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ─── Ordenação ───────────────────────────────────────────────────────────── */

const sortLabels: Record<TaskSort, string> = {
  DueAsc: "Prazo mais próximo",
  DueDesc: "Prazo mais distante",
  Recent: "Mais recentes",
  Owner: "Responsável",
  Status: "Status",
}

export function TaskSortMenu({ value, onChange, showOwner }: { value: TaskSort; onChange: (sort: TaskSort) => void; showOwner: boolean }) {
  const options = (Object.keys(sortLabels) as TaskSort[]).filter((sort) => showOwner || sort !== "Owner")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-9" aria-label={`Ordenar por: ${sortLabels[value]}`}>
          <ArrowDownUp aria-hidden="true" />
          <span className="max-sm:sr-only">{sortLabels[value]}</span>
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {options.map((sort) => (
          <DropdownMenuItem key={sort} onSelect={() => onChange(sort)} aria-current={sort === value || undefined} className={cn(sort === value && "text-fg")}>
            {sortLabels[sort]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ─── Paginação ───────────────────────────────────────────────────────────── */

export function TaskPagination({
  page,
  pageSize,
  totalCount,
  totalPages,
  onPage,
  onPageSize,
}: {
  page: number
  pageSize: PageSize
  totalCount: number
  totalPages: number
  onPage: (page: number) => void
  onPageSize: (size: PageSize) => void
}) {
  const pageButton =
    "inline-flex size-8 cursor-pointer items-center justify-center rounded-xs text-sm tabular transition-colors hover:bg-surface-3 hover:text-fg focus-visible:focus-ring disabled:cursor-default disabled:text-faint disabled:hover:bg-transparent"

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line-soft px-4 py-3 sm:px-5">
      <p className="text-xs text-muted tabular" aria-live="polite">
        {rangeLabel(page, pageSize, totalCount)}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`${pageSize} por página`}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xs border border-line-soft px-2.5 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg focus-visible:focus-ring"
            >
              <span className="tabular">{pageSize}</span> por página
              <ChevronDown className="size-3.5" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-28">
            {PAGE_SIZES.map((size) => (
              <DropdownMenuItem key={size} onSelect={() => onPageSize(size)} className={cn("tabular", size === pageSize && "text-fg")}>
                {size} por página
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {totalPages > 1 && (
          <nav aria-label="Paginação" className="flex items-center gap-0.5">
            <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => onPage(page - 1)} className={cn(pageButton, "text-fg-muted")}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            {pageItems(page, totalPages).map((item) =>
              typeof item === "number" ? (
                <button
                  key={item}
                  type="button"
                  aria-label={`Página ${item}`}
                  aria-current={item === page ? "page" : undefined}
                  onClick={() => onPage(item)}
                  className={cn(pageButton, item === page ? "border border-accent/60 bg-accent/10 text-fg" : "text-fg-muted")}
                >
                  {item}
                </button>
              ) : (
                <span key={item} aria-hidden="true" className="inline-flex size-8 items-center justify-center text-sm text-muted">
                  …
                </span>
              )
            )}
            <button
              type="button"
              aria-label="Próxima página"
              disabled={page >= totalPages}
              onClick={() => onPage(page + 1)}
              className={cn(pageButton, "text-fg-muted")}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </nav>
        )}
      </div>
    </div>
  )
}
