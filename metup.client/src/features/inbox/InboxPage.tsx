import { useEffect, useState } from "react"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useDebouncedValue } from "@/lib/hooks"
import { readUrlState, writeUrlState } from "@/lib/url-state"
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

  function selectConversation(id: string) {
    setSelectedId(id)
  }

  const selectedConversation = conversations.find((c) => c.id === selectedId) ?? null
  const isThreadOpen = selectedId !== null

  return (
    <div className="mx-auto grid h-[calc(100svh-4rem)] w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[22rem_1fr_20rem] lg:items-stretch">
      <section
        aria-label="Conversas"
        className={`flex min-h-0 flex-col lg:flex ${isThreadOpen ? "hidden lg:flex" : "flex"}`}
      >
        <ConversationList
          conversations={conversations}
          totalCount={totalCount}
          selectedId={selectedId}
          search={search}
          isLoading={isListLoading}
          error={listError}
          onSearchChange={setSearch}
          onSelect={selectConversation}
          onRetry={() => setListVersion((v) => v + 1)}
        />
      </section>

      <section
        aria-label="Thread da conversa"
        className={`min-h-0 rounded-xl border border-border bg-card ${isThreadOpen ? "flex flex-col" : "hidden lg:flex lg:flex-col"}`}
      >
        {isThreadOpen && selectedConversation ? (
          <>
            <div className="border-b border-border px-2 py-2 lg:hidden">
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                <ArrowLeft aria-hidden="true" />
                Conversas
              </Button>
            </div>
            <MessageThread
              conversationId={selectedConversation.id}
              contactName={selectedConversation.contactName}
              messages={messages}
              isLoading={isThreadLoading}
              error={threadError}
              onMessageSent={(message) => setMessages((current) => [...current, message])}
            />
          </>
        ) : (
          <p className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            Selecione uma conversa na lista para ver a thread.
          </p>
        )}
      </section>

      <section
        aria-label="Contexto do contato"
        className="hidden min-h-0 overflow-y-auto rounded-xl border border-border bg-card lg:block"
      >
        <ContextPanel context={context} isLoading={isContextLoading} error={contextError} onOpenDeal={onOpenDeal} />
      </section>
    </div>
  )
}
