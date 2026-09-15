import { useEffect, useState } from "react"
import { ArrowLeft, MessagesSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Monogram } from "@/components/ui/monogram"
import { EmptyState } from "@/components/ui/states"
import { useDebouncedValue } from "@/lib/hooks"
import { readUrlState, writeUrlState } from "@/lib/url-state"
import { cn } from "@/lib/utils"
import { toMessage } from "@/features/companies/form-errors"
import { ConversationList } from "./ConversationList"
import { ContextPanel } from "./ContextPanel"
import { MessageThread } from "./MessageThread"
import {
  getConversationContext,
  listConversations,
  listMessages,
  type ConversationContext,
  type ConversationListItem,
  type Message,
} from "./api"

type Props = {
  onOpenDeal: (dealId: string) => void
}

export function InboxPage({ onOpenDeal }: Props) {
  const initialUrlState = readUrlState()

  const [search, setSearch] = useState(initialUrlState.search)
  const debouncedSearch = useDebouncedValue(search)

  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isListLoading, setIsListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [listVersion, setListVersion] = useState(0)

  const [selectedId, setSelectedId] = useState<string | null>(initialUrlState.conversationId)

  const [messages, setMessages] = useState<Message[]>([])
  const [isThreadLoading, setIsThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState<string | null>(null)

  const [context, setContext] = useState<ConversationContext | null>(null)
  const [isContextLoading, setIsContextLoading] = useState(false)
  const [contextError, setContextError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setIsListLoading(true)
    setListError(null)

    listConversations({ search: debouncedSearch }, controller.signal)
      .then((result) => {
        setConversations(result.items)
        setTotalCount(result.totalCount)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setListError(toMessage(error, "Não foi possível carregar as conversas."))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsListLoading(false)
      })

    return () => controller.abort()
  }, [debouncedSearch, listVersion])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      setContext(null)
      return
    }

    const controller = new AbortController()
    setIsThreadLoading(true)
    setThreadError(null)
    setIsContextLoading(true)
    setContextError(null)

    listMessages(selectedId, controller.signal)
      .then(setMessages)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setThreadError(toMessage(error, "Não foi possível carregar a conversa."))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsThreadLoading(false)
      })

    getConversationContext(selectedId, controller.signal)
      .then(setContext)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setContextError(toMessage(error, "Não foi possível carregar o contexto."))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsContextLoading(false)
      })

    return () => controller.abort()
  }, [selectedId])

  useEffect(() => {
    writeUrlState({ search, conversationId: selectedId })
  }, [search, selectedId])

  const selectedConversation = conversations.find((c) => c.id === selectedId) ?? null
  const isThreadOpen = selectedId !== null

  return (
    <div className="grid h-[calc(100svh-3.5rem)] min-h-128 lg:h-svh lg:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)_18rem] 2xl:grid-cols-[22rem_minmax(0,1fr)_20rem]">
      <section
        aria-label="Conversas"
        className={cn("min-h-0 flex-col border-r border-line-soft bg-sunken/40", isThreadOpen ? "hidden lg:flex" : "flex")}
      >
        <ConversationList
          conversations={conversations}
          totalCount={totalCount}
          selectedId={selectedId}
          search={search}
          isLoading={isListLoading}
          error={listError}
          onSearchChange={setSearch}
          onSelect={setSelectedId}
          onRetry={() => setListVersion((v) => v + 1)}
        />
      </section>

      <section
        aria-label="Thread da conversa"
        className={cn("min-h-0 min-w-0 flex-col", isThreadOpen ? "flex" : "hidden lg:flex")}
      >
        {isThreadOpen && selectedConversation ? (
          <>
            {/* Entre lg e xl este cabeçalho é o canto direito da tela: reserva o espaço da busca e do sino (ShellActions). */}
            <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line-soft px-3 sm:px-6 lg:max-xl:pr-56">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                aria-label="Voltar para conversas"
                onClick={() => setSelectedId(null)}
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
              <Monogram name={selectedConversation.contactName} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-base font-medium text-fg">{selectedConversation.contactName}</p>
                <p className="truncate text-sm text-muted">{selectedConversation.companyName}</p>
              </div>
              <span className="label-mono ml-auto hidden text-faint sm:block">WhatsApp</span>
              {context?.dealId && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-auto sm:ml-2 xl:hidden"
                  onClick={() => onOpenDeal(context.dealId!)}
                >
                  Abrir negócio
                </Button>
              )}
            </header>
            <MessageThread
              conversationId={selectedConversation.id}
              messages={messages}
              isLoading={isThreadLoading}
              error={threadError}
              onMessageSent={(message) => setMessages((current) => [...current, message])}
            />
          </>
        ) : (
          <EmptyState
            icon={MessagesSquare}
            title={isThreadOpen ? "Carregando conversa…" : "Nenhuma conversa aberta"}
            description={
              isThreadOpen ? undefined : "Escolha uma conversa na lista para ler a thread e responder com o contexto do negócio ao lado."
            }
            className="flex-1"
          />
        )}
      </section>

      {/* A partir de xl o painel de contexto é o canto direito: começa abaixo da busca e do sino. */}
      <aside aria-label="Contexto do contato" className="hidden min-h-0 overflow-y-auto border-l border-line-soft bg-sunken/40 xl:block xl:pt-14">
        <ContextPanel context={context} isLoading={isContextLoading} error={contextError} onOpenDeal={onOpenDeal} />
      </aside>
    </div>
  )
}
