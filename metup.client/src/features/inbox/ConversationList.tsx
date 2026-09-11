import { Loader2, MessageCircle, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

function relativeTime(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.round(diffMs / 60000)

  if (diffMin < 1) return "agora"
  if (diffMin < 60) return `há ${diffMin} min`
  const diffHours = Math.round(diffMin / 60)
  if (diffHours < 24) return `há ${diffHours}h`
  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `há ${diffDays}d`
  return date.toLocaleDateString("pt-BR")
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
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="conversation-search" className="sr-only">
          Buscar conversa
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="conversation-search"
            type="search"
            name="search"
            className="pl-9"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por contato ou empresa…"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      <p className="tabular text-xs text-muted-foreground" aria-live="polite">
        {isLoading ? "Carregando…" : `${totalCount} ${totalCount === 1 ? "conversa" : "conversas"}`}
      </p>

      {error && (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <button type="button" onClick={onRetry} className="text-xs font-medium text-primary underline-offset-4 hover:underline">
            Tentar de novo
          </button>
        </div>
      )}

      {isLoading && conversations.length === 0 && (
        <p className="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Carregando conversas…
        </p>
      )}

      {!isLoading && !error && conversations.length === 0 && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border px-4 py-6">
          <p className="text-sm text-muted-foreground">
            {search
              ? "Nenhuma conversa encontrada para essa busca."
              : "Nenhuma conversa ainda. Elas aparecem aqui quando chega a primeira mensagem de WhatsApp."}
          </p>
        </div>
      )}

      {conversations.length > 0 && (
        <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1">
          {conversations.map((conversation) => {
            const isSelected = conversation.id === selectedId
            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  aria-current={isSelected ? "true" : undefined}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors outline-none",
                    "focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    isSelected
                      ? "border-primary bg-accent"
                      : "border-transparent hover:border-border hover:bg-muted"
                  )}
                >
                  <MessageCircle
                    className={cn("mt-0.5 size-4 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")}
                    aria-hidden="true"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{conversation.contactName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {relativeTime(conversation.lastMessageAt)}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{conversation.companyName}</span>
                    {conversation.lastMessagePreview && (
                      <span className="block truncate text-xs text-foreground/80">{conversation.lastMessagePreview}</span>
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
