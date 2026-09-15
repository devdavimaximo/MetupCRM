import { MessagesSquare, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Monogram } from "@/components/ui/monogram"
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/states"
import { formatRelative, numberFormatter } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ConversationListItem } from "./api"

type Props = {
  conversations: ConversationListItem[]
  totalCount: number
  selectedId: string | null
  search: string
  isLoading: boolean
  error: string | null
  onSearchChange: (search: string) => void
  onSelect: (conversationId: string) => void
  onRetry: () => void
}

/** Lista de conversas — nasce sempre de uma mensagem inbound entregue pelo n8n (seção 5 do CLAUDE.md). */
export function ConversationList({
  conversations,
  totalCount,
  selectedId,
  search,
  isLoading,
  error,
  onSearchChange,
  onSelect,
  onRetry,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-4 border-b border-line-soft px-4 pt-5 pb-4 lg:pt-6">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="font-display text-xl font-semibold tracking-[-0.015em] text-fg">Conversas</h1>
          <p className="label-mono text-muted" aria-live="polite">
            {isLoading ? "…" : numberFormatter.format(totalCount)}
          </p>
        </div>
        <div>
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
            />
          </div>
        </div>
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
          title={search ? "Nada encontrado" : "Nenhuma conversa ainda"}
          description={
            search
              ? "Nenhuma conversa bate com essa busca."
              : "As conversas aparecem aqui quando chega a primeira mensagem de WhatsApp."
          }
        />
      )}

      {conversations.length > 0 && (
        <ul className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain py-1", isLoading && "opacity-60")}>
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
                      <span className="truncate text-base font-medium text-fg">{conversation.contactName}</span>
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
        </ul>
      )}
    </div>
  )
}
