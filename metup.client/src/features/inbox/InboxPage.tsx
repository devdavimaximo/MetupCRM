import { useEffect, useRef, useState } from "react"
import { ArrowLeft, MessagesSquare, Phone, Video } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Monogram } from "@/components/ui/monogram"
import { EmptyState } from "@/components/ui/states"
import { Hint, TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toast"
import type { DealDrawerSection } from "@/features/deals/deal-section"
import { useDebouncedValue, useMediaQuery } from "@/lib/hooks"
import { useRealtime } from "@/lib/realtime"
import { useToasts } from "@/lib/toasts"
import { readUrlState, writeUrlState } from "@/lib/url-state"
import { cn } from "@/lib/utils"
import { toMessage } from "@/features/companies/form-errors"
import { ConversationList, type ConversationTab } from "./ConversationList"
import { ConversationMenu } from "./ConversationMenu"
import { ContextPanel } from "./ContextPanel"
import { InboxHeader } from "./InboxHeader"
import { MessageThread } from "./MessageThread"
import { useInboxShortcuts } from "./useInboxShortcuts"
import {
  applyConversationTag,
  favoriteConversation,
  getConversationContext,
  getConversationsSummary,
  listConversations,
  listMessages,
  markConversationRead,
  markConversationUnread,
  removeConversationTag,
  setConversationAutomation,
  unfavoriteConversation,
  updateConversationStatus,
  type ConversationChannel,
  type ConversationContext,
  type ConversationCounts,
  type ConversationListItem,
  type ConversationStatus,
  type Message,
} from "./api"
import { CHANNEL_OPTIONS, channelLabels, statusBadgeVariant, STATUS_OPTIONS, statusLabels, telHref } from "./inbox-format"

type Props = {
  onOpenDeal: (dealId: string, section?: DealDrawerSection) => void
  onOpenCompany: (companyId: string) => void
}

const PAGE_SIZE = 50
/** Curto de propósito (item 25): agrupa rajadas de mensagens sem deixar a thread "atrasada". */
const REALTIME_DEBOUNCE_MS = 500
/** Quanto tempo a mensagem chegada agora fica realçada. */
const MESSAGE_HIGHLIGHT_MS = 2_500
/** Abaixo de `lg` a thread cobre a lista (mestre-detalhe) — o mesmo ponto de corte do grid e do botão "Voltar". */
const MOBILE_THREAD_QUERY = "(max-width: 1023px)"

const TAB_FROM_URL: Record<string, ConversationTab> = { "nao-lidas": "unread", favoritas: "favorite" }
const TAB_TO_URL: Record<ConversationTab, string> = { all: "", unread: "nao-lidas", favorite: "favoritas" }

function parseChannels(raw: string): ConversationChannel[] {
  const values = raw.split(",").filter(Boolean)
  return CHANNEL_OPTIONS.filter((option) => values.includes(option))
}

function parseStatuses(raw: string): ConversationStatus[] {
  const values = raw.split(",").filter(Boolean)
  return STATUS_OPTIONS.filter((option) => values.includes(option))
}

export function InboxPage({ onOpenDeal, onOpenCompany }: Props) {
  const initialUrlState = readUrlState()
  const toasts = useToasts()

  const [search, setSearch] = useState(initialUrlState.search)
  const debouncedSearch = useDebouncedValue(search)

  const [tab, setTab] = useState<ConversationTab>(TAB_FROM_URL[initialUrlState.conversationTab] ?? "all")
  const [channels, setChannels] = useState<ConversationChannel[]>(() => parseChannels(initialUrlState.conversationChannels))
  const [statuses, setStatuses] = useState<ConversationStatus[]>(() => parseStatuses(initialUrlState.conversationStatuses))

  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [isListLoading, setIsListLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [listVersion, setListVersion] = useState(0)

  const [counts, setCounts] = useState<ConversationCounts | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(initialUrlState.conversationId)

  const [messages, setMessages] = useState<Message[]>([])
  const [isThreadLoading, setIsThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState<string | null>(null)

  const [context, setContext] = useState<ConversationContext | null>(null)
  const [isContextLoading, setIsContextLoading] = useState(false)
  const [contextError, setContextError] = useState<string | null>(null)
  const [isAutomationPending, setIsAutomationPending] = useState(false)

  // ── Tempo real (item 25) ──────────────────────────────────────────────────────
  const [highlightedMessageIds, setHighlightedMessageIds] = useState<ReadonlySet<string>>(() => new Set())
  const messageHighlightTimer = useRef<number | undefined>(undefined)
  const realtimeTimer = useRef<number | undefined>(undefined)
  const pendingThreadRefresh = useRef(false)
  const pendingContextRefresh = useRef(false)
  const pendingListItemIds = useRef<Set<string>>(new Set())
  const pendingRevalidate = useRef(false)

  useEffect(
    () => () => {
      window.clearTimeout(messageHighlightTimer.current)
      window.clearTimeout(realtimeTimer.current)
    },
    []
  )

  const isLoadingMoreRef = useRef(false)
  const filterKeyRef = useRef("")

  const channelsKey = channels.join(",")
  const statusesKey = statuses.join(",")
  const listFilterKey = `${debouncedSearch}|${tab}|${channelsKey}|${statusesKey}|${listVersion}`

  useEffect(() => {
    filterKeyRef.current = listFilterKey
  }, [listFilterKey])

  // Troca de aba/canal/status/busca sempre volta para a página 1 (item 14).
  useEffect(() => {
    const controller = new AbortController()
    setIsListLoading(true)
    setListError(null)
    setPage(1)

    listConversations(
      {
        search: debouncedSearch,
        channel: channels,
        status: statuses,
        unread: tab === "unread" ? true : undefined,
        favorite: tab === "favorite" ? true : undefined,
        page: 1,
        pageSize: PAGE_SIZE,
      },
      controller.signal
    )
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, tab, channelsKey, statusesKey, listVersion])

  useEffect(() => {
    getConversationsSummary()
      .then(setCounts)
      .catch(() => {
        /* o resumo das abas é só um contador auxiliar — sem retry dedicado, a lista continua valendo */
      })
  }, [listVersion])

  function loadMore() {
    if (isLoadingMoreRef.current) return
    const key = filterKeyRef.current
    const nextPage = page + 1
    isLoadingMoreRef.current = true
    setIsLoadingMore(true)

    listConversations({
      search: debouncedSearch,
      channel: channels,
      status: statuses,
      unread: tab === "unread" ? true : undefined,
      favorite: tab === "favorite" ? true : undefined,
      page: nextPage,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        if (filterKeyRef.current !== key) return
        setConversations((current) => [...current, ...result.items])
        setTotalCount(result.totalCount)
        setPage(nextPage)
      })
      .catch(() => {
        /* falha silenciosa: o sentinela tenta de novo no próximo scroll */
      })
      .finally(() => {
        isLoadingMoreRef.current = false
        setIsLoadingMore(false)
      })
  }

  // Toda ação do menu `⋮` (item 18) e do painel de contexto (itens 19/21) é otimista: muda a tela na
  // hora e desfaz com um aviso se o servidor recusar (regra do bloco comum da onda C3).
  function toggleFavorite(conversation: ConversationListItem) {
    const next = !conversation.isFavorite
    setConversations((current) => current.map((c) => (c.id === conversation.id ? { ...c, isFavorite: next } : c)))
    setCounts((current) => (current ? { ...current, favorite: Math.max(0, current.favorite + (next ? 1 : -1)) } : current))

    const request = next ? favoriteConversation(conversation.id) : unfavoriteConversation(conversation.id)
    request.catch((error: unknown) => {
      setConversations((current) => current.map((c) => (c.id === conversation.id ? { ...c, isFavorite: !next } : c)))
      setCounts((current) => (current ? { ...current, favorite: Math.max(0, current.favorite + (next ? -1 : 1)) } : current))
      toasts.show({ tone: "danger", message: toMessage(error, "Não foi possível favoritar a conversa.") })
    })
  }

  function changeStatus(conversationId: string, next: ConversationStatus) {
    const previous = conversations.find((c) => c.id === conversationId)?.status
    setConversations((current) => current.map((c) => (c.id === conversationId ? { ...c, status: next } : c)))
    if (selectedId === conversationId) {
      setContext((current) => (current ? { ...current, status: next } : current))
    }

    updateConversationStatus(conversationId, next).catch((error: unknown) => {
      if (previous) {
        setConversations((current) => current.map((c) => (c.id === conversationId ? { ...c, status: previous } : c)))
        if (selectedId === conversationId) {
          setContext((current) => (current ? { ...current, status: previous } : current))
        }
      }
      toasts.show({ tone: "danger", message: toMessage(error, "Não foi possível mudar o status da conversa.") })
    })
  }

  function markUnread(conversationId: string) {
    setConversations((current) => current.map((c) => (c.id === conversationId ? { ...c, isUnread: true } : c)))
    setCounts((current) => (current ? { ...current, unread: current.unread + 1 } : current))

    markConversationUnread(conversationId).catch((error: unknown) => {
      setConversations((current) => current.map((c) => (c.id === conversationId ? { ...c, isUnread: false } : c)))
      setCounts((current) => (current ? { ...current, unread: Math.max(0, current.unread - 1) } : current))
      toasts.show({ tone: "danger", message: toMessage(error, "Não foi possível marcar como não lida.") })
    })
  }

  function toggleAutomation(conversationId: string, next: boolean) {
    setContext((current) => (current ? { ...current, automationEnabled: next } : current))
    setIsAutomationPending(true)

    setConversationAutomation(conversationId, next)
      .catch((error: unknown) => {
        setContext((current) => (current ? { ...current, automationEnabled: !next } : current))
        toasts.show({ tone: "danger", message: toMessage(error, "Não foi possível atualizar a automação.") })
      })
      .finally(() => setIsAutomationPending(false))
  }

  function applyTag(conversationId: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed) return

    setContext((current) =>
      current && !current.tags.includes(trimmed) ? { ...current, tags: [...current.tags, trimmed].sort((a, b) => a.localeCompare(b)) } : current
    )

    applyConversationTag(conversationId, trimmed).catch((error: unknown) => {
      setContext((current) => (current ? { ...current, tags: current.tags.filter((t) => t !== trimmed) } : current))
      toasts.show({ tone: "danger", message: toMessage(error, "Não foi possível aplicar a tag.") })
    })
  }

  function removeTag(conversationId: string, tagOptionId: string, name: string) {
    setContext((current) => (current ? { ...current, tags: current.tags.filter((t) => t !== name) } : current))

    removeConversationTag(conversationId, tagOptionId).catch((error: unknown) => {
      setContext((current) =>
        current && !current.tags.includes(name) ? { ...current, tags: [...current.tags, name].sort((a, b) => a.localeCompare(b)) } : current
      )
      toasts.show({ tone: "danger", message: toMessage(error, "Não foi possível remover a tag.") })
    })
  }

  // ── Tempo real (item 25) ──────────────────────────────────────────────────────
  // O evento do hub só diz "isto mudou" (sem o valor novo — ver `RealtimeEventMessage` no back).
  // Cada tipo refaz a consulta certa; tudo é agrupado por um debounce curto para rajadas de mensagem.

  /** Mensagem nova na thread aberta: busca de novo, realça o que chegou e marca como lida se for inbound. */
  async function refreshThread() {
    if (!selectedId) return
    const id = selectedId
    try {
      const fresh = await listMessages(id)
      const known = new Set(messages.map((m) => m.id))
      const added = fresh.filter((m) => !known.has(m.id))
      setMessages(fresh)

      if (added.length > 0) {
        setHighlightedMessageIds(new Set(added.map((m) => m.id)))
        window.clearTimeout(messageHighlightTimer.current)
        messageHighlightTimer.current = window.setTimeout(() => setHighlightedMessageIds(new Set()), MESSAGE_HIGHLIGHT_MS)

        if (added.some((m) => m.direction === "Inbound")) {
          // O SDR está olhando a conversa agora — não deixa o badge de não lida acender para ele.
          markConversationRead(id).catch(() => {})
          setConversations((current) => current.map((c) => (c.id === id ? { ...c, isUnread: false } : c)))
        }
      }
    } catch {
      /* falha silenciosa: o próximo evento tenta de novo */
    }
  }

  /** Status/automação/tags da conversa aberta podem ter mudado em outra aba. */
  async function refreshContext() {
    if (!selectedId) return
    const id = selectedId
    try {
      setContext(await getConversationContext(id))
    } catch {
      /* falha silenciosa */
    }
  }

  /**
   * Atualiza só o item de uma conversa na lista, sem reordenar (evita a linha "pular" embaixo do
   * cursor de quem está navegando). Se ela não estiver carregada, só revalida os contadores das
   * abas — sem forçar a lista a recarregar.
   */
  async function refreshListItem(conversationId: string) {
    if (!conversations.some((c) => c.id === conversationId)) {
      getConversationsSummary().then(setCounts).catch(() => {})
      return
    }

    try {
      const result = await listConversations({
        search: debouncedSearch,
        channel: channels,
        status: statuses,
        unread: tab === "unread" ? true : undefined,
        favorite: tab === "favorite" ? true : undefined,
        page: 1,
        pageSize: Math.max(conversations.length, PAGE_SIZE),
      })
      const fresh = result.items.find((c) => c.id === conversationId)
      setConversations((current) =>
        fresh ? current.map((c) => (c.id === conversationId ? fresh : c)) : current.filter((c) => c.id !== conversationId)
      )
      if (!fresh) setTotalCount((total) => Math.max(0, total - 1))
    } catch {
      /* falha silenciosa: o próximo evento tenta de novo */
    }
    getConversationsSummary().then(setCounts).catch(() => {})
  }

  /** Reconexão, foco sem conexão ou 60s sem eventos: refaz a página 1, os contadores e a thread aberta. */
  function revalidateAll() {
    listConversations({
      search: debouncedSearch,
      channel: channels,
      status: statuses,
      unread: tab === "unread" ? true : undefined,
      favorite: tab === "favorite" ? true : undefined,
      page: 1,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        setConversations(result.items)
        setTotalCount(result.totalCount)
        setPage(1)
      })
      .catch(() => {})
    getConversationsSummary().then(setCounts).catch(() => {})
    if (selectedId) {
      void refreshThread()
      void refreshContext()
    }
  }

  function flushRealtime() {
    if (pendingRevalidate.current) {
      pendingRevalidate.current = false
      pendingThreadRefresh.current = false
      pendingContextRefresh.current = false
      pendingListItemIds.current.clear()
      revalidateAll()
      return
    }
    if (pendingThreadRefresh.current) {
      pendingThreadRefresh.current = false
      void refreshThread()
    }
    if (pendingContextRefresh.current) {
      pendingContextRefresh.current = false
      void refreshContext()
    }
    const ids = pendingListItemIds.current
    pendingListItemIds.current = new Set()
    ids.forEach((id) => void refreshListItem(id))
  }

  useRealtime((event) => {
    if (event.type === "revalidate") {
      pendingRevalidate.current = true
    } else if (
      event.conversationId &&
      (event.type === "conversation.messageReceived" ||
        event.type === "conversation.messageSent" ||
        event.type === "conversation.statusChanged" ||
        event.type === "conversation.favorited")
    ) {
      const id = event.conversationId
      const isMessageEvent = event.type === "conversation.messageReceived" || event.type === "conversation.messageSent"
      if (id === selectedId && isMessageEvent) pendingThreadRefresh.current = true
      if (id === selectedId && event.type === "conversation.statusChanged") pendingContextRefresh.current = true
      pendingListItemIds.current.add(id)
    } else {
      return
    }
    window.clearTimeout(realtimeTimer.current)
    realtimeTimer.current = window.setTimeout(flushRealtime, REALTIME_DEBOUNCE_MS)
  })

  useEffect(() => {
    // Realce é por id de mensagem: trocar de conversa invalida qualquer realce pendente da anterior.
    setHighlightedMessageIds(new Set())
    window.clearTimeout(messageHighlightTimer.current)

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

    // Abrir a conversa marca como lida — em paralelo, sem esperar resposta para renderizar.
    markConversationRead(selectedId).catch(() => {
      /* falha silenciosa: o badge de não lida volta a aparecer no próximo carregamento se persistir */
    })
    const target = conversations.find((c) => c.id === selectedId)
    if (target?.isUnread) {
      setConversations((current) => current.map((c) => (c.id === selectedId ? { ...c, isUnread: false } : c)))
      setCounts((current) => (current ? { ...current, unread: Math.max(0, current.unread - 1) } : current))
    }

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  useEffect(() => {
    writeUrlState({
      search,
      conversationId: selectedId,
      conversationTab: TAB_TO_URL[tab],
      conversationChannels: channelsKey,
      conversationStatuses: statusesKey,
    })
  }, [search, selectedId, tab, channelsKey, statusesKey])

  const selectedConversation = conversations.find((c) => c.id === selectedId) ?? null
  const isThreadOpen = selectedId !== null
  const hasMore = conversations.length < totalCount

  function changeTab(next: ConversationTab) {
    setTab(next)
  }

  const activeChannel = context?.channel ?? selectedConversation?.channel ?? null
  const activeStatus = context?.status ?? selectedConversation?.status ?? null
  const activePhone = context?.contactWhatsApp ?? context?.contactPhone ?? null

  // ── Atalhos de teclado (item 23) ──────────────────────────────────────────────
  const isMobileThread = useMediaQuery(MOBILE_THREAD_QUERY) && isThreadOpen
  useInboxShortcuts({
    conversations,
    selectedId,
    isThreadOpenOnMobile: isMobileThread,
    onSelect: setSelectedId,
    onFocusSearch: () => document.getElementById("conversation-search")?.focus(),
    onBack: () => setSelectedId(null),
  })

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100svh-3.5rem)] flex-col lg:h-svh">
        <InboxHeader channels={channels} onChannelsChange={setChannels} statuses={statuses} onStatusesChange={setStatuses} />

        <div className="grid min-h-0 flex-1 lg:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)_18rem] 2xl:grid-cols-[22rem_minmax(0,1fr)_20rem]">
          <section
            aria-label="Conversas"
            className={cn("min-h-0 flex-col border-r border-line-soft bg-sunken/40", isThreadOpen ? "hidden lg:flex" : "flex")}
          >
            <ConversationList
              conversations={conversations}
              totalCount={totalCount}
              selectedId={selectedId}
              search={search}
              tab={tab}
              counts={counts}
              isLoading={isListLoading}
              isLoadingMore={isLoadingMore}
              hasMore={hasMore}
              error={listError}
              onSearchChange={setSearch}
              onTabChange={changeTab}
              onSelect={setSelectedId}
              onRetry={() => setListVersion((v) => v + 1)}
              onLoadMore={loadMore}
            />
          </section>

          <section
            aria-label="Thread da conversa"
            className={cn("min-h-0 min-w-0 flex-col", isThreadOpen ? "flex" : "hidden lg:flex")}
          >
            {isThreadOpen && selectedConversation ? (
              <>
                <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line-soft px-3 sm:px-6">
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-fg">{selectedConversation.contactName}</p>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate text-sm text-muted">{selectedConversation.companyName}</p>
                      {activeStatus && (
                        <Badge variant={statusBadgeVariant[activeStatus]} className="shrink-0">
                          {statusLabels[activeStatus]}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {activeChannel && <span className="label-mono hidden shrink-0 text-faint sm:block">{channelLabels[activeChannel]}</span>}

                  <div className="flex shrink-0 items-center gap-0.5">
                    {activePhone && (
                      <Button asChild variant="ghost" size="icon-sm">
                        <a href={telHref(activePhone)} aria-label={`Ligar para ${activePhone}`} title={`Ligar para ${activePhone}`}>
                          <Phone aria-hidden="true" />
                        </a>
                      </Button>
                    )}
                    <Hint content="Em breve">
                      <span tabIndex={0} className="inline-flex rounded-xs focus-visible:focus-ring">
                        <Button type="button" variant="ghost" size="icon-sm" disabled aria-label="Chamada de vídeo (em breve)">
                          <Video aria-hidden="true" />
                        </Button>
                      </span>
                    </Hint>
                    <ConversationMenu
                      contactName={selectedConversation.contactName}
                      status={activeStatus ?? selectedConversation.status}
                      isFavorite={selectedConversation.isFavorite}
                      dealId={context?.dealId ?? null}
                      companyId={selectedConversation.companyId}
                      onMarkUnread={() => markUnread(selectedConversation.id)}
                      onToggleFavorite={() => toggleFavorite(selectedConversation)}
                      onChangeStatus={(status) => changeStatus(selectedConversation.id, status)}
                      onOpenDeal={onOpenDeal}
                      onOpenCompany={onOpenCompany}
                    />
                  </div>

                  {context?.dealId && (
                    <Button type="button" size="sm" variant="outline" className="xl:hidden" onClick={() => onOpenDeal(context.dealId!)}>
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
                  highlightedMessageIds={highlightedMessageIds}
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

          <aside aria-label="Contexto do contato" className="hidden min-h-0 overflow-y-auto border-l border-line-soft bg-sunken/40 xl:block">
            <ContextPanel
              conversationId={selectedId}
              context={context}
              isLoading={isContextLoading}
              error={contextError}
              onOpenDeal={onOpenDeal}
              onApplyTag={applyTag}
              onRemoveTag={removeTag}
              onToggleAutomation={toggleAutomation}
              isAutomationPending={isAutomationPending}
            />
          </aside>
        </div>
      </div>

      <Toaster toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </TooltipProvider>
  )
}
