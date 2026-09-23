import { useEffect, useRef } from "react"
import { MessagesSquare, Search, Star } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Monogram } from "@/components/ui/monogram"
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/states"
import { formatRelative, numberFormatter, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ConversationCounts, ConversationListItem } from "./api"

export type ConversationTab = "all" | "unread" | "favorite"

const TABS: { key: ConversationTab; label: string; countKey: keyof ConversationCounts }[] = [
  { key: "all", label: "Todas", countKey: "total" },
  { key: "unread", label: "Não lidas", countKey: "unread" },
  { key: "favorite", label: "Favoritas", countKey: "favorite" },
]

type Props = {
  conversations: ConversationListItem[]
  totalCount: number
  selectedId: string | null
  search: string
  tab: ConversationTab
  counts: ConversationCounts | null
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null
  onSearchChange: (search: string) => void
  onTabChange: (tab: ConversationTab) => void
  onSelect: (conversationId: string) => void
  onRetry: () => void
  onLoadMore: () => void
}

/** Lista de conversas — nasce sempre de uma mensagem inbound entregue pelo n8n (seção 5 do CLAUDE.md). */
export function ConversationList({
  conversations,
  totalCount,
  selectedId,
  search,
  tab,
  counts,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  onSearchChange,
  onTabChange,
  onSelect,
  onRetry,
  onLoadMore,
}: Props) {
  const listRef = useRef<HTMLUListElement>(null)
  const sentinelRef = useRef<HTMLLIElement>(null)
  const onLoadMoreRef = useRef(onLoadMore)
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore
  })

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore || isLoading || error) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMoreRef.current()
      },
      { root: listRef.current, rootMargin: "0px 0px 240px 0px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoading, error, conversations.length])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-2 border-b border-line-soft px-4 pt-4 pb-3 lg:pt-5">
        <Label htmlFor="conversation-search" className="sr-only">
          Buscar conversa
        </Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input
            id="conversation-search"
            type="search"
            name="search"
            className="h-9 pl-9"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por contato ou empresa…"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="conversation-shortcuts-hint"
          />
        </div>
        <p className="sr-only" aria-live="polite">
          {isLoading && conversations.length === 0
            ? "Carregando conversas…"
            : pluralize(totalCount, "conversa encontrada", "conversas encontradas")}
        </p>
        <p id="conversation-shortcuts-hint" className="sr-only">
          Atalhos de teclado: barra foca esta busca, J e K navegam entre as conversas da lista, Esc volta para a lista no celular.
        </p>
      </div>

      <div role="tablist" aria-label="Recortes de conversas" className="flex shrink-0 gap-1 border-b border-line-soft px-3 py-2">
        {TABS.map(({ key, label, countKey }) => {
          const active = key === tab
          const count = counts?.[countKey]
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`inbox-tab-${key}`}
              aria-selected={active}
              aria-controls="inbox-conversation-list"
              onClick={() => onTabChange(key)}
              className={cn(
                "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xs px-2.5 text-sm transition-colors focus-visible:focus-ring",
                active ? "bg-accent/10 text-accent" : "text-fg-muted hover:bg-surface-2 hover:text-fg"
              )}
            >
              {label}
              {count !== undefined && (
                <span className={cn("rounded-xs px-1.5 py-px text-2xs tabular", active ? "bg-accent/15 text-accent" : "bg-surface-3 text-fg-muted")}>
                  {numberFormatter.format(count)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <div className="p-3">
          <Alert onRetry={onRetry}>{error}</Alert>
        </div>
      )}

      {isLoading && conversations.length === 0 && <SkeletonRows rows={8} label="Carregando conversas…" />}

      {!isLoading && !error && conversations.length === 0 && (
        <EmptyState
          compact
          icon={MessagesSquare}
          title={search ? "Nada encontrado" : tab === "unread" ? "Nenhuma conversa não lida" : tab === "favorite" ? "Nenhuma conversa favorita" : "Nenhuma conversa ainda"}
          description={
            search
              ? "Nenhuma conversa bate com essa busca."
              : tab === "all"
                ? "As conversas aparecem aqui quando chega a primeira mensagem de WhatsApp."
                : "Mude de aba para ver as demais conversas."
          }
        />
      )}

      {conversations.length > 0 && (
        <ul
          id="inbox-conversation-list"
          role="tabpanel"
          aria-labelledby={`inbox-tab-${tab}`}
          ref={listRef}
          className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain py-1", isLoading && "opacity-60")}
        >
          {conversations.map((conversation) => {
            const isSelected = conversation.id === selectedId
            return (
              <li key={conversation.id} className="px-1.5">
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  aria-current={isSelected ? "true" : undefined}
                  className={cn(
                    "relative flex w-full cursor-pointer items-start gap-3 rounded-xs px-2.5 py-3 text-left transition-colors focus-visible:focus-ring",
                    isSelected ? "bg-surface-2" : "hover:bg-surface-2/60"
                  )}
                >
                  {isSelected && <span aria-hidden="true" className="absolute top-2.5 bottom-2.5 -left-1.5 w-0.5 bg-accent" />}
                  <Monogram name={conversation.contactName} size="sm" className={cn(isSelected && "border-accent/40 text-accent")} />

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {conversation.isUnread && (
                          <>
                            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
                            <span className="sr-only">Não lida</span>
                          </>
                        )}
                        <span className={cn("truncate text-base text-fg", conversation.isUnread ? "font-semibold" : "font-medium")}>
                          {conversation.contactName}
                        </span>
                        {conversation.isFavorite && (
                          <>
                            <Star className="size-3.5 shrink-0 fill-accent text-accent" aria-hidden="true" />
                            <span className="sr-only">Favorita</span>
                          </>
                        )}
                      </span>
                      <span className="shrink-0 font-mono text-2xs text-faint tabular">
                        {formatRelative(conversation.lastMessageAt)}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-muted">{conversation.companyName}</span>
                    {conversation.lastMessagePreview && (
                      <span className="mt-1 block truncate text-sm text-fg-muted">{conversation.lastMessagePreview}</span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}

          {hasMore && (
            <li ref={sentinelRef} aria-hidden="true" className="shrink-0">
              {isLoadingMore && <SkeletonRows rows={2} className="pt-1" />}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
