import type { ReactNode, RefObject } from "react"
import { ArrowDownUp, ChevronDown, Plus, Search, X } from "lucide-react"

import { RealtimeIndicator } from "@/components/RealtimeIndicator"
import { Button } from "@/components/ui/button"
import { ToggleChips } from "@/components/ui/choice-chips"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { DealBoardSort, DealSource } from "./api"
import {
  BOARD_SORTS,
  MAX_PIPELINE_PERIOD_DAYS,
  boardSortLabels,
  isPipelinePreset,
  pipelinePeriodLabel,
  pipelinePeriodPresets,
} from "./pipeline-url"
import { sourceLabels } from "./stage-labels"
import type { BoardFilters, DealBoardView } from "./useDealBoard"

/* ─── Cabeçalho ───────────────────────────────────────────────────────────── */

/**
 * Trilha, título e, à direita, período (só vale para Fechados), responsável (Admin/Closer) e o CTA.
 * No celular o CTA vira o FAB da página.
 */
export function PipelineHeader({
  view,
  ownerPicker,
  shortcuts,
  onNewDeal,
}: {
  view: DealBoardView
  ownerPicker: ReactNode
  /** A folha de atalhos (item 22), à esquerda do CTA. */
  shortcuts: ReactNode
  onNewDeal: () => void
}) {
  return (
    <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <nav aria-label="Trilha de navegação">
          <ol className="label-mono flex items-center gap-2 text-muted">
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="h-px w-5 shrink-0 bg-accent" />
              Comercial
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-accent">
              Pipeline
            </li>
          </ol>
        </nav>
        <div className="flex items-center">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-fg">Pipeline Comercial</h1>
          <RealtimeIndicator />
        </div>
        <p className="max-w-2xl text-base text-fg-muted">Acompanhe cada etapa do funil e mova os negócios até o fechamento.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 max-md:*:basis-full xl:shrink-0 xl:flex-nowrap">
        <DateRangePicker
          label={`Fechados: ${pipelinePeriodLabel(view.period)}`}
          presets={pipelinePeriodPresets}
          activePresetId={view.period.kind === "preset" ? view.period.preset : null}
          range={view.range}
          maxDate={view.today}
          maxDays={MAX_PIPELINE_PERIOD_DAYS}
          onPresetSelect={(id) => {
            if (isPipelinePreset(id)) view.setPeriod({ kind: "preset", preset: id })
          }}
          onRangeSelect={({ from, to }) => view.setPeriod({ kind: "custom", from, to })}
          className="min-w-56"
        />
        {ownerPicker}
        {shortcuts}
        <Button type="button" onClick={onNewDeal} className="h-10 max-md:hidden">
          <Plus aria-hidden="true" />
          Novo negócio
        </Button>
      </div>
    </header>
  )
}

/* ─── Filtros ─────────────────────────────────────────────────────────────── */

const SOURCES = Object.keys(sourceLabels) as DealSource[]

function FilterPopover({
  label,
  count,
  children,
  triggerRef,
  width = "w-[min(24rem,calc(100vw-1.5rem))]",
}: {
  label: string
  count: number
  children: ReactNode
  triggerRef?: RefObject<HTMLButtonElement | null>
  width?: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button ref={triggerRef} type="button" variant="outline" size="sm" className="h-9 max-md:h-11" aria-label={count > 0 ? `${label} (${count} marcados)` : label}>
          {label}
          {count > 0 && (
            <span className="inline-flex min-w-4.5 items-center justify-center rounded-full bg-accent px-1 text-2xs text-on-accent tabular">{count}</span>
          )}
          <ChevronDown aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label={`Filtrar por ${label.toLowerCase()}`} align="start" className={cn("flex flex-col gap-3 p-4", width)}>
        {children}
      </PopoverContent>
    </Popover>
  )
}

/**
 * Busca, origem, segmento e ordenação das colunas ativas. A busca vai ao servidor com debounce (no
 * hook); os chips aplicam na hora. O badge conta os filtros ativos; "Limpar" zera os três.
 */
export function PipelineFilters({
  filters,
  sort,
  segments,
  segmentsFailed,
  activeCount,
  onChange,
  onSort,
  onClear,
  searchRef,
  filtersRef,
}: {
  /** `/` foca a busca e `F` abre os filtros (item 22). */
  searchRef: RefObject<HTMLInputElement | null>
  filtersRef: RefObject<HTMLButtonElement | null>
  filters: BoardFilters
  sort: DealBoardSort
  segments: string[] | null
  segmentsFailed: boolean
  activeCount: number
  onChange: (filters: BoardFilters) => void
  onSort: (sort: DealBoardSort) => void
  onClear: () => void
}) {
  // Segmento marcado por link que não existe mais na organização continua visível para poder desmarcar.
  const segmentOptions = [...new Set([...(segments ?? []), ...filters.segments])]

  return (
    <div role="search" aria-label="Filtros do quadro" className="flex flex-wrap items-center gap-2">
      <label className="flex h-9 max-md:h-11 min-w-0 flex-1 items-center gap-2 rounded-sm border border-line-soft bg-surface px-3 focus-within:border-line-strong has-[input:focus-visible]:focus-ring max-sm:basis-full sm:max-w-72">
        <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
        <span className="sr-only">Buscar no quadro por empresa ou contato</span>
        <input
          ref={searchRef}
          type="search"
          name="quadro-busca"
          value={filters.search}
          maxLength={100}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Buscar empresa ou contato…"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted"
        />
      </label>

      <FilterPopover label="Origem" count={filters.sources.length} triggerRef={filtersRef}>
        <ToggleChips
          label="Origem"
          options={SOURCES.map((source) => ({ value: source, label: sourceLabels[source] }))}
          values={filters.sources}
          onChange={(sources) => onChange({ ...filters, sources })}
        />
      </FilterPopover>

      <FilterPopover label="Segmento" count={filters.segments.length}>
        {segmentsFailed && segmentOptions.length === 0 ? (
          <p className="text-sm text-danger">Não foi possível carregar os segmentos.</p>
        ) : segments === null && segmentOptions.length === 0 ? (
          <p className="text-sm text-muted">Carregando segmentos…</p>
        ) : segmentOptions.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma empresa com segmento cadastrado.</p>
        ) : (
          <ToggleChips
            label="Segmento"
            options={segmentOptions.map((segment) => ({ value: segment, label: segment }))}
            values={filters.segments}
            onChange={(values) => onChange({ ...filters, segments: values })}
            className="max-h-64 overflow-y-auto"
          />
        )}
      </FilterPopover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-9 max-md:h-11" aria-label={`Ordenar colunas por: ${boardSortLabels[sort]}`}>
            <ArrowDownUp aria-hidden="true" />
            <span className="max-sm:sr-only">{boardSortLabels[sort]}</span>
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {BOARD_SORTS.map((option) => (
            <DropdownMenuItem key={option} onSelect={() => onSort(option)} aria-current={option === sort || undefined} className={cn(option === sort && "text-fg")}>
              {boardSortLabels[option]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {activeCount > 0 && (
        <div className="flex items-center gap-1">
          <span className="rounded-xs bg-accent/10 px-2 py-1 text-xs text-accent tabular" aria-live="polite">
            {activeCount === 1 ? "1 filtro ativo" : `${activeCount} filtros ativos`}
          </span>
          <Button type="button" size="sm" variant="ghost" className="h-9 max-md:h-11" onClick={onClear}>
            <X aria-hidden="true" />
            Limpar
          </Button>
        </div>
      )}
    </div>
  )
}
