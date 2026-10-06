import type { ReactNode } from "react"
import { Bot, Layers, Loader2 } from "lucide-react"

import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SkeletonRows } from "@/components/ui/states"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { LeadSearch } from "./api"
import { isSearchActive, searchProgress, searchState, type SearchTone } from "./lead-format"

const toneDot: Record<SearchTone, string> = {
  active: "bg-accent",
  done: "bg-success",
  warning: "bg-accent/50 ring-1 ring-accent",
  danger: "bg-danger",
  muted: "bg-faint",
}

/**
 * Histórico de buscas numa gaveta lateral: fora do caminho, para a tabela de leads ocupar a tela.
 * Escolher uma busca filtra a tabela por ela; "Todas" mostra a base inteira de leads garimpados.
 * Buscas em andamento mostram o contador subindo em tempo real.
 */
export function SearchHistorySheet({
  open,
  onOpenChange,
  searches,
  isLoading,
  selectedId,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  searches: LeadSearch[] | null
  isLoading: boolean
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="sm" className="sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Histórico de buscas</SheetTitle>
          <SheetDescription>Escolha uma busca para ver só os leads dela.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <SearchHistoryList searches={searches} isLoading={isLoading} selectedId={selectedId} onSelect={onSelect} />
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

function SearchHistoryList({
  searches,
  isLoading,
  selectedId,
  onSelect,
}: {
  searches: LeadSearch[] | null
  isLoading: boolean
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
      <nav aria-label="Buscas de leads" className="flex flex-col p-2">
        <HistoryItem selected={selectedId === null} onClick={() => onSelect(null)}>
          <Layers className="size-4 shrink-0 text-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">Todas as buscas</span>
        </HistoryItem>

        {isLoading && !searches && <SkeletonRows rows={3} label="Carregando buscas…" />}

        {searches?.length === 0 && (
          <p className="px-3 py-4 text-sm text-muted">Nenhuma busca ainda. Comece pelo campo acima.</p>
        )}

        {searches?.map((search) => {
          const state = searchState(search)
          const active = isSearchActive(search)
          return (
            <HistoryItem key={search.id} selected={selectedId === search.id} onClick={() => onSelect(search.id)}>
              <span className="mt-1.5 flex size-2 shrink-0 items-center justify-center self-start" aria-hidden="true">
                <span className={cn("size-2 rounded-full", toneDot[state.tone], active && "animate-pulse")} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-fg first-letter:uppercase">{search.query}</span>
                <span className="truncate text-xs text-muted">{search.location ?? "Sem região"}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  {active && <Loader2 className="size-3 animate-spin text-accent" aria-hidden="true" />}
                  <span className={cn(state.tone === "danger" && "text-danger", state.tone === "warning" && "text-accent")}>{state.label}</span>
                </span>
                <span className="truncate text-xs text-muted tabular">{searchProgress(search)}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1 self-start text-2xs text-faint">
                <time dateTime={search.requestedAt}>{formatRelative(search.requestedAt)}</time>
                {search.origin === "Automation" && (
                  <Bot className="size-3.5" aria-label="Disparada pela automação" />
                )}
              </span>
            </HistoryItem>
          )
        })}
      </nav>
  )
}

function HistoryItem({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-current={selected || undefined}
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xs border-l-2 px-3 py-2.5 text-left transition-colors focus-visible:focus-ring",
        selected ? "border-accent bg-surface-2" : "border-transparent hover:bg-surface-2/60"
      )}
    >
      {children}
    </button>
  )
}
