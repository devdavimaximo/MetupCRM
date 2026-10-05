import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2, Plug, Radar, RotateCw, Search, SearchX, Smartphone, XCircle, Globe } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ToggleChips } from "@/components/ui/choice-chips"
import { controlClasses } from "@/components/ui/input"
import { Page, PageHeader } from "@/components/ui/page"
import { SegmentedControl } from "@/components/ui/segmented"
import { Select } from "@/components/ui/select"
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/states"
import { Toaster } from "@/components/ui/toast"
import { TooltipProvider } from "@/components/ui/tooltip"
import { toMessage } from "@/features/companies/form-errors"
import { listUsers } from "@/features/deals/api"
import { pageItems } from "@/features/tasks/task-format"
import { can, type AuthenticatedUser } from "@/lib/auth"
import { formatRelative, numberFormatter } from "@/lib/format"
import { useAsyncResource, useDebouncedValue } from "@/lib/hooks"
import { useRealtime } from "@/lib/realtime"
import { useToasts } from "@/lib/toasts"
import { readUrlState, writeUrlState, type View } from "@/lib/url-state"
import { cn } from "@/lib/utils"
import {
  cancelLeadSearch,
  importFoundLeads,
  listFoundLeads,
  listLeadSearches,
  retryLeadSearch,
  triageFoundLeads,
  type FoundLead,
  type FoundLeadSort,
  type FoundLeadStatus,
  type LeadSearch,
} from "./api"
import { AutomationSettingsSheet } from "./AutomationSettingsSheet"
import { isSearchActive, searchProgress, searchState, searchTitle } from "./lead-format"
import { LeadBulkBar, type ImportOptions } from "./LeadBulkBar"
import { LeadTable, type RowActions } from "./LeadTable"
import { SearchComposer } from "./SearchComposer"
import { SearchHistory } from "./SearchHistory"

const PAGE_SIZE = 50
/** Enquanto houver busca andando, relê o histórico de tempos em tempos: "sem resposta" depende do relógio. */
const ACTIVE_POLL_MS = 20_000
/** Lotes chegam em rajada; a tabela se atualiza no máximo uma vez neste intervalo. */
const LIVE_RELOAD_MS = 1_200
const IMPORT_PREFS_KEY = "metup.leads.schedule-call"

const TAB_URL: Record<FoundLeadStatus, string> = {
  New: "",
  Imported: "importados",
  Discarded: "descartados",
}
const SORT_LABELS: Record<FoundLeadSort, string> = {
  Rating: "Melhor avaliados",
  Reviews: "Mais avaliações",
  Name: "Nome (A–Z)",
  Recent: "Mais recentes",
}

type Filter = "phone" | "noSite"

const EMPTY_SELECTION: ReadonlySet<string> = new Set()

function readTab(): FoundLeadStatus {
  const tab = readUrlState().leadTab
  return tab === "importados" ? "Imported" : tab === "descartados" ? "Discarded" : "New"
}

function readSchedulePreference() {
  try {
    return localStorage.getItem(IMPORT_PREFS_KEY) !== "0"
  } catch {
    return true
  }
}

/**
 * Buscador de leads: o SDR pede "clínicas odontológicas em Curitiba", a automação do n8n garimpa e
 * os resultados caem aqui em tempo real para triagem — importar (empresa + negócio no funil, com
 * ligação para hoje) ou descartar. Substitui a planilha: o que entra já é dado do funil.
 */
export function LeadFinderPage({
  user,
  onOpenDeal,
  onNavigate,
}: {
  user: AuthenticatedUser
  onOpenDeal: (dealId: string) => void
  onNavigate: (view: View) => void
}) {
  const canAssignOthers = can(user, "TeamWideAccess")
  const canConfigure = can(user, "SettingsManage")

  const [searchId, setSearchId] = useState<string | null>(() => readUrlState().leadSearchId || null)
  const [tab, setTab] = useState<FoundLeadStatus>(readTab)
  const [text, setText] = useState("")
  const [filters, setFilters] = useState<Filter[]>([])
  const [minRating, setMinRating] = useState<number | null>(null)
  const [sort, setSort] = useState<FoundLeadSort>("Rating")
  const [pageState, setPageState] = useState({ key: "", page: 1 })
  const [selection, setSelection] = useState<{ key: string; ids: Set<string> }>({ key: "", ids: new Set() })
  const lastToggled = useRef<string | null>(null)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState<"import" | "discard" | "restore" | null>(null)
  const [importOptions, setImportOptions] = useState<ImportOptions>(() => ({
    ownerUserId: null,
    scheduleCall: readSchedulePreference(),
  }))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchActionBusy, setSearchActionBusy] = useState(false)
  const toasts = useToasts()

  const search = useDebouncedValue(text.trim(), 300)

  const searches = useAsyncResource((signal) => listLeadSearches(signal), [], {
    keepPreviousData: true,
  })
  const users = useAsyncResource((signal) => listUsers(signal), [], {
    enabled: canAssignOthers,
  })

  // Página e seleção valem para um recorte: filtro novo volta à página 1 e esquece a seleção — derivado
  // da chave, sem efeito sincronizando estado (e sem uma busca a mais com a página antiga).
  const filterKey = JSON.stringify([searchId, tab, search, filters, minRating, sort])
  const page = pageState.key === filterKey ? pageState.page : 1
  const setPage = (next: number) => setPageState({ key: filterKey, page: next })

  const leadFilters = useMemo(
    () => ({
      searchId,
      status: tab,
      search,
      hasPhone: filters.includes("phone") ? true : null,
      hasWebsite: filters.includes("noSite") ? false : null,
      minRating,
      sort,
      page,
      pageSize: PAGE_SIZE,
    }),
    [searchId, tab, search, filters, minRating, sort, page],
  )

  const leads = useAsyncResource((signal) => listFoundLeads(leadFilters, signal), [leadFilters], { keepPreviousData: true })

  const viewKey = `${filterKey}|${page}`
  const selected = selection.key === viewKey ? selection.ids : EMPTY_SELECTION
  const setSelected = (update: Set<string> | ((current: Set<string>) => Set<string>)) =>
    setSelection((current) => {
      const base = current.key === viewKey ? current.ids : new Set<string>()
      return {
        key: viewKey,
        ids: typeof update === "function" ? update(base) : update,
      }
    })

  useEffect(() => {
    writeUrlState({ leadSearchId: searchId ?? "", leadTab: TAB_URL[tab] })
  }, [searchId, tab])

  useEffect(() => {
    try {
      localStorage.setItem(IMPORT_PREFS_KEY, importOptions.scheduleCall ? "1" : "0")
    } catch {
      /* conveniência — sem storage, só não lembra */
    }
  }, [importOptions.scheduleCall])

  const selectedSearch = searches.data?.find((s) => s.id === searchId) ?? null
  const anyActive = searches.data?.some(isSearchActive) ?? false

  // Tempo real: lote chegou, busca terminou ou alguém triou leads. Rajadas viram uma releitura só.
  const reloadTimer = useRef<number | undefined>(undefined)
  const reloadLeads = leads.reload
  const reloadSearches = searches.reload
  const reloadLeadsSoon = useCallback(() => {
    if (reloadTimer.current !== undefined) return
    reloadTimer.current = window.setTimeout(() => {
      reloadTimer.current = undefined
      reloadLeads({ silent: true })
    }, LIVE_RELOAD_MS)
  }, [reloadLeads])
  useEffect(() => () => window.clearTimeout(reloadTimer.current), [])

  useRealtime((event) => {
    if (event.type === "leadSearch.updated" || event.type === "revalidate") {
      reloadSearches({ silent: true })
      if (event.type === "revalidate" || !searchId || event.leadSearchId === searchId) reloadLeadsSoon()
    }
  })

  useEffect(() => {
    if (!anyActive) return
    const timer = window.setInterval(() => reloadSearches({ silent: true }), ACTIVE_POLL_MS)
    return () => window.clearInterval(timer)
  }, [anyActive, reloadSearches])

  function refreshAfterChange() {
    leads.reload({ silent: true })
    searches.reload({ silent: true })
  }

  function announceImport(count: number, dealIds: string[]) {
    if (count === 0) {
      toasts.show({
        message: "Nada a importar: os leads selecionados já estavam no pipeline.",
      })
      return
    }
    toasts.show({
      message: count === 1 ? "1 lead foi para o pipeline." : `${numberFormatter.format(count)} leads foram para o pipeline.`,
      action: {
        label: dealIds.length === 1 ? "Ver negócio" : "Abrir pipeline",
        onAction: () => (dealIds.length === 1 ? onOpenDeal(dealIds[0]) : onNavigate("pipeline")),
      },
      durationMs: 7000,
    })
  }

  async function withRowBusy(id: string, action: () => Promise<void>) {
    setBusyIds((current) => new Set(current).add(id))
    try {
      await action()
    } finally {
      setBusyIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    }
  }

  const rowActions: RowActions = {
    busyIds,
    onOpenDeal,
    onImport: (lead) =>
      withRowBusy(lead.id, async () => {
        try {
          const result = await importFoundLeads({
            ids: [lead.id],
            ...importOptions,
          })
          announceImport(result.imported, result.dealIds)
          refreshAfterChange()
        } catch (err) {
          toasts.show({
            message: toMessage(err, "Não foi possível importar o lead."),
            tone: "danger",
          })
        }
      }),
    onDiscard: (lead) =>
      withRowBusy(lead.id, async () => {
        try {
          await triageFoundLeads({ ids: [lead.id], action: "Discard" })
          refreshAfterChange()
          toasts.show({
            message: `${lead.name} foi descartado.`,
            action: {
              label: "Desfazer",
              onAction: () =>
                void triageFoundLeads({
                  ids: [lead.id],
                  action: "Restore",
                }).then(refreshAfterChange),
            },
          })
        } catch (err) {
          toasts.show({
            message: toMessage(err, "Não foi possível descartar o lead."),
            tone: "danger",
          })
        }
      }),
    onRestore: (lead) =>
      withRowBusy(lead.id, async () => {
        try {
          await triageFoundLeads({ ids: [lead.id], action: "Restore" })
          refreshAfterChange()
        } catch (err) {
          toasts.show({
            message: toMessage(err, "Não foi possível restaurar o lead."),
            tone: "danger",
          })
        }
      }),
  }

  async function runBulk(kind: "import" | "discard" | "restore") {
    const ids = [...selected]
    setBulkBusy(kind)
    try {
      if (kind === "import") {
        const result = await importFoundLeads({ ids, ...importOptions })
        announceImport(result.imported, result.dealIds)
      } else {
        const result = await triageFoundLeads({
          ids,
          action: kind === "discard" ? "Discard" : "Restore",
        })
        toasts.show({
          message: `${numberFormatter.format(result.changed)} ${result.changed === 1 ? "lead" : "leads"} ${kind === "discard" ? "descartado(s)" : "de volta aos novos"}.`,
        })
      }
      setSelected(new Set())
      refreshAfterChange()
    } catch (err) {
      toasts.show({
        message: toMessage(err, "Não foi possível alterar os leads selecionados."),
        tone: "danger",
      })
    } finally {
      setBulkBusy(null)
    }
  }

  function toggle(id: string, shift: boolean) {
    const items = leads.data?.items ?? []
    setSelected((current) => {
      const next = new Set(current)
      const turnOn = !current.has(id)
      const from = shift && lastToggled.current ? items.findIndex((l) => l.id === lastToggled.current) : -1
      const to = items.findIndex((l) => l.id === id)
      const range = from >= 0 && to >= 0 ? items.slice(Math.min(from, to), Math.max(from, to) + 1) : [items[to]]
      for (const lead of range) {
        if (!lead) continue
        if (turnOn) next.add(lead.id)
        else next.delete(lead.id)
      }
      return next
    })
    lastToggled.current = id
  }

  function toggleAll() {
    const items = leads.data?.items ?? []
    setSelected((current) => (items.every((l) => current.has(l.id)) ? new Set() : new Set(items.map((l) => l.id))))
  }

  async function changeSearch(action: "cancel" | "retry", target: LeadSearch) {
    setSearchActionBusy(true)
    try {
      await (action === "cancel" ? cancelLeadSearch(target.id) : retryLeadSearch(target.id))
      searches.reload({ silent: true })
    } catch (err) {
      toasts.show({
        message: toMessage(err, "Não foi possível alterar a busca."),
        tone: "danger",
      })
    } finally {
      setSearchActionBusy(false)
    }
  }

  const counts = leads.data?.counts
  const filtersActive = search !== "" || filters.length > 0 || minRating !== null
  const items: FoundLead[] = leads.data?.items ?? []

  return (
    <TooltipProvider>
      <Page width="wide">
        <PageHeader
          eyebrow="Prospecção ativa"
          title="Buscar leads"
          description="Diga o nicho e a região. A automação garimpa nos mapas e os leads chegam aqui, prontos para triar e mandar para o funil."
          actions={
            canConfigure && (
              <Button type="button" variant="outline" onClick={() => setSettingsOpen(true)}>
                <Plug aria-hidden="true" />
                Conexão com a automação
              </Button>
            )
          }
        />

        <SearchComposer
          recent={searches.data ?? []}
          onRequested={(created) => {
            searches.setData((current) => [created, ...(current ?? []).filter((s) => s.id !== created.id)])
            setSearchId(created.id)
            setTab("New")
          }}
        />

        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <SearchHistory searches={searches.data} isLoading={searches.isLoading} selectedId={searchId} onSelect={setSearchId} />

          <div className="flex min-w-0 flex-col gap-4">
            {selectedSearch && (
              <SearchBanner
                search={selectedSearch}
                busy={searchActionBusy}
                onCancel={() => changeSearch("cancel", selectedSearch)}
                onRetry={() => changeSearch("retry", selectedSearch)}
              />
            )}

            <Card className="min-w-0">
              <div className="flex flex-col gap-3 border-b border-line-soft px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SegmentedControl
                    label="Situação dos leads"
                    value={tab}
                    onChange={setTab}
                    options={[
                      { value: "New", label: "Novos", count: counts?.new },
                      {
                        value: "Imported",
                        label: "Importados",
                        count: counts?.imported,
                      },
                      {
                        value: "Discarded",
                        label: "Descartados",
                        count: counts?.discarded,
                      },
                    ]}
                  />
                  <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                    <input
                      type="search"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Nome, categoria, bairro…"
                      aria-label="Buscar nos leads"
                      className={cn(controlClasses, "h-9 pl-9")}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ToggleChips<Filter>
                    label="Filtros"
                    values={filters}
                    onChange={setFilters}
                    options={[
                      {
                        value: "phone",
                        label: "Com telefone",
                        icon: Smartphone,
                      },
                      { value: "noSite", label: "Sem site", icon: Globe },
                    ]}
                  />
                  <div className="w-40">
                    <Select
                      aria-label="Nota mínima"
                      value={minRating ?? ""}
                      onChange={(e) => setMinRating(e.target.value ? Number(e.target.value) : null)}
                      className="h-8 text-sm"
                    >
                      <option value="">Qualquer nota</option>
                      <option value="4">Nota 4,0+</option>
                      <option value="4.5">Nota 4,5+</option>
                    </Select>
                  </div>
                  <div className="ml-auto w-44">
                    <Select
                      aria-label="Ordenar por"
                      value={sort}
                      onChange={(e) => setSort(e.target.value as FoundLeadSort)}
                      className="h-8 text-sm"
                    >
                      {(Object.keys(SORT_LABELS) as FoundLeadSort[]).map((key) => (
                        <option key={key} value={key}>
                          {SORT_LABELS[key]}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              <div aria-busy={leads.isLoading} className={cn("relative", leads.isLoading && leads.data && "opacity-70 transition-opacity")}>
                {leads.error && !leads.data ? (
                  <div className="p-4">
                    <Alert onRetry={() => leads.reload()}>{toMessage(leads.error, "Não foi possível carregar os leads.")}</Alert>
                  </div>
                ) : !leads.data ? (
                  <SkeletonRows rows={8} label="Carregando leads…" />
                ) : items.length === 0 ? (
                  <LeadsEmpty
                    tab={tab}
                    filtersActive={filtersActive}
                    activeSearch={selectedSearch && isSearchActive(selectedSearch) ? selectedSearch : null}
                    hasSearches={(searches.data?.length ?? 0) > 0}
                    onClearFilters={() => {
                      setText("")
                      setFilters([])
                      setMinRating(null)
                    }}
                  />
                ) : (
                  <LeadTable leads={items} selected={selected} onToggle={toggle} onToggleAll={toggleAll} actions={rowActions} />
                )}
              </div>

              {selected.size > 0 && (
                <LeadBulkBar
                  count={selected.size}
                  tab={tab}
                  busy={bulkBusy}
                  canAssignOthers={canAssignOthers}
                  users={users.data ?? [{ id: user.userId, name: user.name }]}
                  currentUserId={user.userId}
                  importOptions={importOptions}
                  onImportOptionsChange={setImportOptions}
                  onImport={() => runBulk("import")}
                  onDiscard={() => void runBulk("discard")}
                  onRestore={() => void runBulk("restore")}
                  onClear={() => setSelected(new Set())}
                />
              )}

              {leads.data && leads.data.totalCount > 0 && (
                <Pagination
                  page={leads.data.page}
                  totalPages={leads.data.totalPages}
                  totalCount={leads.data.totalCount}
                  pageSize={PAGE_SIZE}
                  onPage={setPage}
                />
              )}
            </Card>
          </div>
        </div>

        {canConfigure && <AutomationSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />}
        <Toaster toasts={toasts.toasts} onDismiss={toasts.dismiss} />
      </Page>
    </TooltipProvider>
  )
}

/* ─── Peças da página ─────────────────────────────────────────────────────── */

function SearchBanner({
  search,
  busy,
  onCancel,
  onRetry,
}: {
  search: LeadSearch
  busy: boolean
  onCancel: () => void
  onRetry: () => void
}) {
  const state = searchState(search)
  const active = isSearchActive(search)
  const canRetry = search.origin === "Crm" && (search.isStalled || search.status === "Failed")
  const canCancel = search.status === "Requested" || search.status === "Running"

  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-3 rounded-sm border-l-2 bg-surface-2 px-4 py-3",
        state.tone === "danger"
          ? "border-danger"
          : state.tone === "warning" || state.tone === "active"
            ? "border-accent"
            : "border-line-strong",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex items-center gap-2 text-sm font-medium text-fg">
          {active ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-accent" aria-hidden="true" />
          ) : (
            <Radar className="size-4 shrink-0 text-muted" aria-hidden="true" />
          )}
          <span className="truncate first-letter:uppercase">{searchTitle(search)}</span>
        </p>
        <p className="text-xs text-muted tabular">
          {state.label} · {searchProgress(search)}
          {search.requestedByName ? ` · pedida por ${search.requestedByName}` : " · disparada pela automação"}{" "}
          {formatRelative(search.requestedAt)}
        </p>
        {search.isStalled && (
          <p className="text-xs text-accent">A automação não respondeu a tempo. Confira se o fluxo do n8n está ativo e reenvie.</p>
        )}
        {search.status === "Failed" && search.errorMessage && <p className="text-xs text-danger">{search.errorMessage}</p>}
      </div>
      <div className="flex gap-2">
        {canRetry && (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onRetry}>
            <RotateCw aria-hidden="true" />
            Reenviar
          </Button>
        )}
        {canCancel && (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
            <XCircle aria-hidden="true" />
            Cancelar busca
          </Button>
        )}
      </div>
    </div>
  )
}

function LeadsEmpty({
  tab,
  filtersActive,
  activeSearch,
  hasSearches,
  onClearFilters,
}: {
  tab: FoundLeadStatus
  filtersActive: boolean
  activeSearch: LeadSearch | null
  hasSearches: boolean
  onClearFilters: () => void
}) {
  if (filtersActive) {
    return (
      <EmptyState
        icon={SearchX}
        title="Nenhum lead com esses filtros"
        description="Afrouxe a nota mínima ou tire um filtro."
        action={
          <Button type="button" size="sm" variant="outline" onClick={onClearFilters}>
            Limpar filtros
          </Button>
        }
      />
    )
  }

  if (tab === "New" && activeSearch) {
    return (
      <EmptyState
        icon={Spinner}
        title="A automação está garimpando"
        description={`Os leads de "${activeSearch.query}" aparecem aqui conforme chegam — não precisa recarregar.`}
      />
    )
  }

  if (tab === "Imported")
    return (
      <EmptyState
        icon={Radar}
        title="Nenhum lead importado ainda"
        description="Importe da aba Novos: cada lead vira empresa + negócio em Prospect."
      />
    )
  if (tab === "Discarded")
    return <EmptyState icon={Radar} title="Nada descartado" description="Leads fora do perfil ficam aqui e não voltam em buscas futuras." />

  return (
    <EmptyState
      icon={Radar}
      title={hasSearches ? "Todos os leads desta busca já foram triados" : "Peça sua primeira busca"}
      description={
        hasSearches
          ? "Veja os importados ou peça uma busca nova."
          : 'Escreva um nicho e uma região lá em cima — por exemplo, "clínicas odontológicas" em "Curitiba, PR".'
      }
    />
  )
}

function Pagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPage,
}: {
  page: number
  totalPages: number
  totalCount: number
  pageSize: number
  onPage: (page: number) => void
}) {
  const from = (page - 1) * pageSize + 1
  const to = Math.min(totalCount, page * pageSize)
  const pageButton =
    "inline-flex size-9 cursor-pointer items-center justify-center rounded-xs text-sm tabular transition-colors hover:bg-surface-3 hover:text-fg focus-visible:focus-ring disabled:cursor-default disabled:text-faint disabled:hover:bg-transparent"

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line-soft px-4 py-3 sm:px-5">
      <p className="text-xs text-muted tabular" aria-live="polite">
        Mostrando {numberFormatter.format(from)}–{numberFormatter.format(to)} de {numberFormatter.format(totalCount)} leads
      </p>
      {totalPages > 1 && (
        <nav aria-label="Paginação" className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Página anterior"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className={cn(pageButton, "text-fg-muted")}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          {pageItems(page, totalPages).map((item) =>
            typeof item === "number" ? (
              <button
                key={item}
                type="button"
                aria-label={`Página ${item}`}
                aria-current={item === page ? "page" : undefined}
                onClick={() => onPage(item)}
                className={cn(pageButton, item === page ? "border border-accent/60 bg-accent/10 text-fg" : "text-fg-muted")}
              >
                {item}
              </button>
            ) : (
              <span key={item} aria-hidden="true" className="inline-flex size-9 items-center justify-center text-sm text-muted">
                …
              </span>
            ),
          )}
          <button
            type="button"
            aria-label="Próxima página"
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
            className={cn(pageButton, "text-fg-muted")}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  )
}

function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn(className, "animate-spin text-accent")} />
}
