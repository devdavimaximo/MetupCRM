import { useMemo, useState } from "react"
import { CircleCheckBig, ListFilter, PhoneCall, PhoneOff, RotateCw, Search, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ToggleChips } from "@/components/ui/choice-chips"
import { Kbd } from "@/components/ui/command-palette"
import { Input } from "@/components/ui/input"
import { Page, PageHeader } from "@/components/ui/page"
import { Select } from "@/components/ui/select"
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/states"
import { Toaster } from "@/components/ui/toast"
import { toMessage } from "@/features/companies/form-errors"
import { can, type AuthenticatedUser } from "@/lib/auth"
import { numberFormatter, pluralize } from "@/lib/format"
import { useAsyncResource } from "@/lib/hooks"
import { useToasts } from "@/lib/toasts"
import { getDialerQueue, listMyPhoneLines, type DialerQueueItem } from "./api"
import { CallPanel, type CallSaved } from "./CallPanel"
import { ANSWERED_OUTCOMES, sessionOrder } from "./dialer-rules"
import { DialerQueueList } from "./DialerQueueList"
import { PhoneLinesSheet } from "./PhoneLinesSheet"

/** Chegada com um lote (ex.: "Importar e discar" no buscador): a sessão começa só com ele. */
export type DialerIntent = { dealIds: string[] }

type Filter = "overdue"

const filterOptions = [{ value: "overdue" as const, label: "Só atrasadas" }]

type SessionStats = { calls: number; answered: number; meetings: number }

function lineStorageKey(userId: string) {
  return `metup.dialer.line.${userId}`
}

function readStoredLine(userId: string): string | null {
  try {
    return localStorage.getItem(lineStorageKey(userId))
  } catch {
    return null
  }
}

function storeLine(userId: string, lineId: string) {
  try {
    localStorage.setItem(lineStorageKey(userId), lineId)
  } catch {
    /* conveniência — sem storage, volta para a principal */
  }
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
}

function matchesText(item: DialerQueueItem, text: string) {
  if (!text) return true
  const haystack = normalize([item.companyName, item.contactName, item.segment, item.city, item.lead?.searchQuery].filter(Boolean).join(" "))
  return haystack.includes(normalize(text))
}

/**
 * Discador (power dialer): a fila de ligações de hoje do usuário logado, uma de cada vez. Ligar,
 * marcar o desfecho e salvar já traz o próximo com o foco em "Ligar".
 *
 * A fila é do próprio usuário e a ligação sai da linha dele — dois SDRs nunca discam o mesmo lead
 * nem "do mesmo número". A sessão (pulados, feitos, contadores) vive só nesta tela.
 */
export function DialerPage({
  user,
  intent,
  onOpenDeal,
}: {
  user: AuthenticatedUser
  intent: DialerIntent | null
  onOpenDeal: (dealId: string) => void
}) {
  const canManageLines = can(user, "PhoneLinesManage")
  const queue = useAsyncResource((signal) => getDialerQueue(signal), [], { keepPreviousData: true })
  const lines = useAsyncResource((signal) => listMyPhoneLines(signal), [], { keepPreviousData: true })

  const [chosenLineId, setChosenLineId] = useState<string | null>(() => readStoredLine(user.userId))
  const batch = useMemo(() => new Set(intent?.dealIds ?? []), [intent])
  const [batchOnly, setBatchOnly] = useState(batch.size > 0)
  const [filters, setFilters] = useState<Filter[]>([])
  const [text, setText] = useState("")
  const [skipped, setSkipped] = useState<string[]>([])
  const [done, setDone] = useState<ReadonlySet<string>>(new Set())
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [stats, setStats] = useState<SessionStats>({ calls: 0, answered: 0, meetings: 0 })
  const [linesOpen, setLinesOpen] = useState(false)
  const toasts = useToasts()

  const myLines = lines.data ?? []
  const line = myLines.find((l) => l.id === chosenLineId) ?? myLines[0] ?? null

  const allItems = queue.data?.items ?? []
  const filtered = allItems.filter(
    (item) =>
      (!batchOnly || batch.has(item.dealId)) && (!filters.includes("overdue") || item.isOverdue) && matchesText(item, text.trim())
  )
  const ordered = sessionOrder(filtered, skipped, done)
  const current = ordered.find((item) => item.dealId === currentId) ?? ordered[0] ?? null
  const currentIndex = current ? ordered.indexOf(current) : -1

  const queuedIds = new Set(allItems.map((item) => item.dealId))
  const batchOutside = [...batch].filter((id) => !queuedIds.has(id)).length

  /** O próximo depois do atual na ordem da sessão (ou o primeiro, se o atual era o último). */
  function nextAfterCurrent(): string | null {
    if (!current) return null
    const rest = ordered.filter((item) => item.dealId !== current.dealId)
    const after = ordered.slice(currentIndex + 1)
    return (after[0] ?? rest[0])?.dealId ?? null
  }

  function handleSaved(saved: CallSaved) {
    if (!current) return
    const nextId = nextAfterCurrent()
    setDone((previous) => new Set(previous).add(current.dealId))
    setSkipped((previous) => previous.filter((id) => id !== current.dealId))
    setStats((previous) => ({
      calls: previous.calls + 1,
      answered: previous.answered + (ANSWERED_OUTCOMES.has(saved.outcome) ? 1 : 0),
      meetings: previous.meetings + (saved.outcome === "ReuniaoAgendada" ? 1 : 0),
    }))
    setCurrentId(nextId)
    if (saved.warning) toasts.show({ message: saved.warning, tone: "danger", durationMs: 9000 })
  }

  function handleSkip() {
    if (!current) return
    const nextId = nextAfterCurrent()
    setSkipped((previous) => [...previous.filter((id) => id !== current.dealId), current.dealId])
    setCurrentId(nextId)
  }

  function reloadQueue() {
    setDone(new Set())
    setSkipped([])
    setCurrentId(null)
    queue.reload()
  }

  const answeredRate = stats.calls > 0 ? Math.round((stats.answered / stats.calls) * 100) : null

  return (
    <Page width="wide" className="gap-6">
      <PageHeader
        eyebrow="Operação"
        title="Discador"
        description="Sua fila de ligações de hoje, uma de cada vez. Ligue, marque o desfecho e siga — tudo cai na timeline do negócio."
        actions={
          <>
            {myLines.length > 1 && (
              <label className="flex items-center gap-2 text-sm text-fg-muted">
                <span className="max-sm:sr-only">Ligar de</span>
                <Select
                  value={line?.id ?? ""}
                  onChange={(e) => {
                    setChosenLineId(e.target.value)
                    storeLine(user.userId, e.target.value)
                  }}
                  className="h-9 w-auto"
                >
                  {myLines.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label} · {option.number}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            {myLines.length === 1 && line && (
              <p className="text-sm text-fg-muted">
                Ligando de <span className="text-fg">{line.label}</span> <span className="font-mono tabular">{line.number}</span>
              </p>
            )}
            {canManageLines && (
              <Button type="button" variant="outline" onClick={() => setLinesOpen(true)}>
                <Settings2 aria-hidden="true" />
                Linhas
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={reloadQueue} disabled={queue.isLoading}>
              <RotateCw aria-hidden="true" className={queue.isLoading ? "animate-spin" : undefined} />
              Atualizar fila
            </Button>
          </>
        }
      />

      {lines.data && myLines.length === 0 && (
        <Alert tone="neutral">
          <span>
            Você ainda não tem uma linha. Cada pessoa liga do próprio número — {canManageLines ? "cadastre a sua em “Linhas”." : "peça ao administrador para cadastrar a sua."}
          </span>
        </Alert>
      )}

      {batch.size > 0 && (
        <Alert tone="neutral">
          <span>
            {batchOnly ? "Discando o lote que você importou" : "Lote importado disponível"}: {pluralize(batch.size - batchOutside, "negócio", "negócios")} na sua fila
            {batchOutside > 0 && ` · ${numberFormatter.format(batchOutside)} fora dela (já tinham negócio de outra pessoa ou sem ligação para hoje)`}.
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => setBatchOnly((value) => !value)}>
            {batchOnly ? "Ver fila completa" : "Só o lote"}
          </Button>
        </Alert>
      )}

      <dl aria-label="Sessão" className="flex flex-wrap gap-x-8 gap-y-2 border-y border-line-soft py-3">
        <Stat label="Na fila" value={numberFormatter.format(ordered.length)} />
        <Stat label="Ligações na sessão" value={numberFormatter.format(stats.calls)} />
        <Stat label="Atendidas" value={answeredRate === null ? "—" : `${numberFormatter.format(stats.answered)} (${answeredRate}%)`} />
        <Stat label="Reuniões" value={numberFormatter.format(stats.meetings)} />
        <p className="ml-auto hidden items-center gap-1.5 self-center text-xs text-muted lg:flex">
          <Kbd>L</Kbd> liga · <Kbd>1</Kbd>–<Kbd>7</Kbd> desfecho · <Kbd>P</Kbd> pula · <Kbd>Ctrl ↵</Kbd> salva
        </p>
      </dl>

      {queue.error && !queue.data ? (
        <Alert onRetry={() => queue.reload()}>{toMessage(queue.error, "Não foi possível carregar a fila.")}</Alert>
      ) : queue.isLoading && !queue.data ? (
        <SkeletonRows rows={6} label="Carregando a fila…" />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside aria-label="Fila" className="flex flex-col gap-3 max-lg:order-last lg:sticky lg:top-6">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <Input
                type="search"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Filtrar por empresa, cidade, busca…"
                aria-label="Filtrar a fila"
                name="dialer-filter"
                autoComplete="off"
                className="pl-9"
              />
            </div>
            <ToggleChips label="Filtros da fila" options={filterOptions} values={filters} onChange={setFilters} />
            <div className="max-h-[60vh] overflow-y-auto overscroll-contain rounded-sm border border-line-soft bg-surface">
              {ordered.length === 0 ? (
                <EmptyState compact icon={ListFilter} title="Nada nesta fila" description="Nenhuma ligação pendente com estes filtros." />
              ) : (
                <DialerQueueList items={ordered} currentDealId={current?.dealId ?? null} onSelect={setCurrentId} />
              )}
            </div>
            {queue.data && queue.data.totalCount > allItems.length && (
              <p className="text-xs text-muted">
                Mostrando {numberFormatter.format(allItems.length)} de {numberFormatter.format(queue.data.totalCount)} ligações pendentes.
              </p>
            )}
          </aside>

          <section aria-label="Ligação atual" className="rounded-sm border border-line-soft bg-surface p-5 shadow-raised sm:p-6">
            {current ? (
              <CallPanel
                key={current.dealId}
                item={current}
                line={line}
                position={stats.calls + 1}
                total={stats.calls + ordered.length}
                onSaved={handleSaved}
                onSkip={handleSkip}
                onOpenDeal={onOpenDeal}
              />
            ) : stats.calls > 0 ? (
              <EmptyState
                icon={CircleCheckBig}
                title="Fila concluída"
                description={`${pluralize(stats.calls, "ligação registrada", "ligações registradas")} nesta sessão, ${pluralize(stats.answered, "atendida", "atendidas")}.`}
                action={
                  <Button type="button" variant="outline" onClick={reloadQueue}>
                    <RotateCw aria-hidden="true" />
                    Atualizar fila
                  </Button>
                }
              />
            ) : allItems.length === 0 ? (
              <EmptyState
                icon={PhoneOff}
                title="Nenhuma ligação para hoje"
                description="As ligações agendadas para você (inclusive as do “Importar e discar” no Buscar leads) aparecem aqui."
              />
            ) : (
              <EmptyState icon={PhoneCall} title="Nada com estes filtros" description="Limpe a busca ou os filtros para ver o resto da fila." />
            )}
          </section>
        </div>
      )}

      {canManageLines && <PhoneLinesSheet open={linesOpen} onOpenChange={setLinesOpen} onChanged={() => lines.reload({ silent: true })} />}

      <Toaster toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </Page>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="label-mono text-faint">{label}</dt>
      <dd className="text-lg font-medium text-fg tabular">{value}</dd>
    </div>
  )
}
