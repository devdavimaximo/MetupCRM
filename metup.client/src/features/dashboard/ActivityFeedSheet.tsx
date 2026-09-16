import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { Loader2, RotateCw } from "lucide-react"

import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/states"
import { toMessage } from "@/features/companies/form-errors"
import { listUsers, type UserSummary } from "@/features/deals/api"
import type { AuthenticatedUser } from "@/lib/auth"
import { useAsyncResource } from "@/lib/hooks"
import { cn } from "@/lib/utils"
import { useRealtime } from "@/lib/realtime"
import { listActivityFeed, type ActivityFeedFilter, type RecentEvent } from "./api"
import { ActivityEventButton } from "./activity-event"

const PAGE_SIZE = 20

/** Lista vazia estável: sem ela, "ainda não carregou" mudaria de identidade a cada render. */
const NO_EVENTS: RecentEvent[] = []

const FILTERS: { value: ActivityFeedFilter; label: string }[] = [
  { value: "DealCreated", label: "Novo negócio" },
  { value: "StageAdvanced", label: "Avanço de etapa" },
  { value: "DealWon", label: "Ganho" },
  { value: "DealLost", label: "Perdido" },
  { value: "Call", label: "Ligação" },
  { value: "WhatsApp", label: "WhatsApp" },
  { value: "Meeting", label: "Reunião" },
  { value: "Proposal", label: "Proposta" },
  { value: "Note", label: "Nota" },
]

const dayWithMonth = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" })
const dayWithYear = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" })

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/** "Hoje", "Ontem", "12 de setembro" (com o ano só quando não é o ano corrente). */
function dayLabel(date: Date, now = new Date()) {
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (localDayKey(date) === localDayKey(now)) return "Hoje"
  if (localDayKey(date) === localDayKey(yesterday)) return "Ontem"
  return (date.getFullYear() === now.getFullYear() ? dayWithMonth : dayWithYear).format(date)
}

function groupByDay(events: RecentEvent[]) {
  const groups: { key: string; label: string; events: RecentEvent[] }[] = []
  for (const event of events) {
    const date = new Date(event.occurredAt)
    const key = localDayKey(date)
    const last = groups.at(-1)
    if (last?.key === key) last.events.push(event)
    else groups.push({ key, label: dayLabel(date), events: [event] })
  }
  return groups
}

/** O que já foi carregado do feed: as páginas somadas e onde continuar (`cursor` nulo = fim). */
type FeedData = { items: RecentEvent[]; cursor: string | null }

/** Estado só das páginas seguintes. Amarrado ao filtro a que pertence: mudou o filtro, zera. */
type MoreState = { key: string; loading: boolean; error: string | null }

/**
 * "Ver todas" da Atividade Recente: o feed inteiro da operação, do mais recente para trás, sem
 * depender do período do dashboard. Página por cursor, "Carregar mais" e carregamento ao rolar.
 * Filtros por tipo e, para quem enxerga a organização, por responsável do negócio — o servidor
 * decide o escopo de novo. O pai remonta o componente a cada abertura, então ele sempre começa limpo.
 */
export function ActivityFeedSheet({
  open,
  role,
  onOpenChange,
  onOpenDeal,
  returnFocusRef,
}: {
  open: boolean
  role: AuthenticatedUser["role"]
  onOpenChange: (open: boolean) => void
  onOpenDeal: (dealId: string) => void
  /** Para onde o foco volta ao fechar (o sheet é controlado e remontado, sem gatilho do Radix). */
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const canFilterOwner = role === "Admin" || role === "Closer"
  const [kinds, setKinds] = useState<ActivityFeedFilter[]>([])
  const [ownerUserId, setOwnerUserId] = useState("")
  const [users, setUsers] = useState<UserSummary[]>([])

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const moreRequest = useRef<AbortController | null>(null)

  const filterKey = `${[...kinds].sort().join(",")}|${ownerUserId}`
  // Primeira página: ao abrir, ao mudar filtro e no "tentar de novo" antes de qualquer página.
  // Sem `keepPreviousData`, a lista do filtro antigo some no mesmo quadro em que o novo começa.
  const feed = useAsyncResource<FeedData>(
    (signal) =>
      listActivityFeed({ kinds, ownerUserId: ownerUserId || undefined, pageSize: PAGE_SIZE }, signal).then((page) => ({
        items: page.items,
        cursor: page.nextCursor,
      })),
    [filterKey],
    { enabled: open }
  )

  const [storedMore, setStoredMore] = useState<MoreState>({ key: filterKey, loading: false, error: null })
  // Derivado no render: o estado das páginas seguintes nunca sobrevive à troca de filtro.
  const more: MoreState = storedMore.key === filterKey ? storedMore : { key: filterKey, loading: false, error: null }

  const items = feed.data?.items ?? NO_EVENTS
  const loaded = feed.data !== null
  const done = feed.data?.cursor === null
  const firstPageError = feed.error ? toMessage(feed.error, "Não foi possível carregar a atividade.") : null

  // O render mais recente, para o que resolve fora dele: resposta de outro filtro nunca se aplica.
  const latest = useRef({ key: filterKey, loaded, items, kinds, ownerUserId })
  useEffect(() => {
    latest.current = { key: filterKey, loaded, items, kinds, ownerUserId }
  })

  useEffect(() => {
    if (!open) return
    moreRequest.current?.abort()
    scrollRef.current?.scrollTo({ top: 0 })
  }, [open, filterKey])

  useEffect(() => {
    if (!open || !canFilterOwner) return
    const controller = new AbortController()
    listUsers(controller.signal)
      .then(setUsers)
      .catch(() => {
        if (!controller.signal.aborted) setUsers([])
      })
    return () => controller.abort()
  }, [open, canFilterOwner])

  /** Próxima página. `retry` ignora o erro anterior (botão "Tentar de novo" depois da 1ª página). */
  const cursor = feed.data?.cursor ?? null
  const setFeedData = feed.setData
  const loadMore = useCallback(
    (retry = false) => {
      if (!loaded || more.loading || cursor === null || (more.error && !retry)) return
      moreRequest.current?.abort()
      const controller = new AbortController()
      moreRequest.current = controller
      const key = latest.current.key

      setStoredMore({ key, loading: true, error: null })
      listActivityFeed({ cursor, kinds, ownerUserId: ownerUserId || undefined, pageSize: PAGE_SIZE }, controller.signal)
        .then((page) => {
          if (controller.signal.aborted || latest.current.key !== key) return
          setFeedData((state) => {
            if (!state) return state
            const seen = new Set(state.items.map((item) => item.id))
            return { items: [...state.items, ...page.items.filter((item) => !seen.has(item.id))], cursor: page.nextCursor }
          })
          setStoredMore({ key, loading: false, error: null })
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || latest.current.key !== key) return
          setStoredMore({ key, loading: false, error: toMessage(err, "Não foi possível carregar mais atividade.") })
        })
    },
    [loaded, more.loading, more.error, cursor, kinds, ownerUserId, setFeedData]
  )

  useEffect(() => () => moreRequest.current?.abort(), [])

  // Tempo real: com o sheet aberto, o que acabou de acontecer entra no topo (com os filtros atuais)
  // e fica realçado por um instante. A lista já carregada e a posição do cursor não mudam.
  const [highlighted, setHighlighted] = useState<ReadonlySet<string>>(() => new Set())
  const realtimeTimer = useRef<number | undefined>(undefined)
  const highlightTimer = useRef<number | undefined>(undefined)
  useEffect(
    () => () => {
      window.clearTimeout(realtimeTimer.current)
      window.clearTimeout(highlightTimer.current)
    },
    []
  )

  useRealtime(() => {
    if (!open) return
    window.clearTimeout(realtimeTimer.current)
    realtimeTimer.current = window.setTimeout(() => {
      const { key, loaded, kinds: currentKinds, ownerUserId: currentOwner } = latest.current
      if (!loaded) return
      listActivityFeed({ kinds: currentKinds, ownerUserId: currentOwner || undefined, pageSize: PAGE_SIZE })
        .then((page) => {
          const current = latest.current
          if (current.key !== key) return
          const seen = new Set(current.items.map((item) => item.id))
          const incoming = page.items.filter((item) => !seen.has(item.id))
          if (incoming.length === 0) return
          setFeedData((state) => {
            if (!state || latest.current.key !== key) return state
            const present = new Set(state.items.map((item) => item.id))
            return { ...state, items: [...incoming.filter((item) => !present.has(item.id)), ...state.items] }
          })
          setHighlighted(new Set(incoming.map((item) => item.id)))
          window.clearTimeout(highlightTimer.current)
          highlightTimer.current = window.setTimeout(() => setHighlighted(new Set()), 2_500)
        })
        .catch(() => undefined)
    }, 2_000)
  })

  // Carregamento ao rolar: o sentinela no fim da lista pede a próxima página ao entrar na área visível.
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!open || !sentinel || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore()
      },
      { root: scrollRef.current, rootMargin: "160px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [open, loadMore, items.length])

  const groups = useMemo(() => groupByDay(items), [items])

  function toggleKind(kind: ActivityFeedFilter) {
    setKinds((current) => (current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind]))
  }

  const hasFilters = kinds.length > 0 || ownerUserId !== ""

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        size="md"
        aria-describedby="activity-feed-description"
        onCloseAutoFocus={(event) => {
          // Ao abrir um negócio a tela troca e o gatilho some; nos demais fechamentos o foco volta a ele.
          if (!returnFocusRef?.current?.isConnected) return
          event.preventDefault()
          returnFocusRef.current.focus()
        }}
      >
        <SheetHeader>
          <SheetTitle>Atividade</SheetTitle>
          <SheetDescription id="activity-feed-description">
            Tudo o que aconteceu nos negócios, do mais recente para trás.
          </SheetDescription>

          <div role="group" aria-label="Filtrar por tipo de evento" className="mt-2 flex flex-wrap gap-1.5">
            {FILTERS.map((filter) => {
              const active = kinds.includes(filter.value)
              return (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleKind(filter.value)}
                  className={cn(
                    "inline-flex h-7 cursor-pointer items-center rounded-sm border px-2.5 text-xs transition-colors focus-visible:focus-ring",
                    active
                      ? "border-accent/60 bg-accent/12 text-accent"
                      : "border-line-soft bg-surface-2 text-fg-muted hover:border-line-strong hover:text-fg"
                  )}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canFilterOwner && (
              <>
                <Label htmlFor="activity-feed-owner" className="sr-only">
                  Filtrar por responsável do negócio
                </Label>
                <Select
                  id="activity-feed-owner"
                  value={ownerUserId}
                  onChange={(e) => setOwnerUserId(e.target.value)}
                  className="h-8 w-full text-xs sm:w-56"
                >
                  <option value="">Todos os responsáveis</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </Select>
              </>
            )}
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setKinds([])
                  setOwnerUserId("")
                }}
                className="cursor-pointer rounded-xs text-xs text-accent hover:text-accent-hover focus-visible:focus-ring"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </SheetHeader>

        <SheetBody ref={scrollRef} data-testid="activity-feed-scroll" className="px-5 sm:px-6">
          {!loaded && !firstPageError && (
            <div role="status" className="flex flex-col gap-3 py-4">
              <span className="sr-only">Carregando atividade…</span>
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-14 rounded-md" />
              ))}
            </div>
          )}

          {loaded && items.length === 0 && !firstPageError && (
            <p className="py-10 text-center text-sm text-muted">
              {hasFilters ? "Nenhum evento com esses filtros." : "Ligações, mudanças de etapa e fechamentos aparecem aqui."}
            </p>
          )}

          {groups.map((group) => (
            <section key={group.key} aria-label={group.label} className="pt-4">
              <h3 className="label-mono sticky top-0 z-10 bg-surface py-1.5 text-faint">{group.label}</h3>
              <ol className="flex flex-col divide-y divide-line-soft/70">
                {group.events.map((event) => (
                  <li key={event.id}>
                    <ActivityEventButton event={event} onOpenDeal={onOpenDeal} highlight={highlighted.has(event.id)} />
                  </li>
                ))}
              </ol>
            </section>
          ))}

          <div ref={sentinelRef} aria-hidden="true" className="h-px" />

          <div aria-live="polite" className="flex flex-col items-center gap-2 py-5">
            {(firstPageError ?? more.error) && (
              <div role="alert" className="flex flex-col items-center gap-2 text-center text-sm text-fg">
                <p>{firstPageError ?? more.error}</p>
                <button
                  type="button"
                  onClick={() => (loaded ? loadMore(true) : feed.reload())}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xs text-sm text-accent hover:text-accent-hover focus-visible:focus-ring"
                >
                  <RotateCw className="size-3.5" aria-hidden="true" />
                  Tentar de novo
                </button>
              </div>
            )}
            {loaded && more.loading && (
              <p className="inline-flex items-center gap-2 text-xs text-muted">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Carregando mais…
              </p>
            )}
            {loaded && !more.loading && !done && !more.error && (
              <button
                type="button"
                onClick={() => loadMore()}
                className="inline-flex h-8 cursor-pointer items-center rounded-sm border border-line-soft px-3 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg focus-visible:focus-ring"
              >
                Carregar mais
              </button>
            )}
            {done && items.length > 0 && <p className="text-xs text-faint">Fim da atividade.</p>}
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
