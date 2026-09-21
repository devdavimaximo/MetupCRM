import { useEffect, useRef, useState, type ReactNode, type Ref } from "react"
import { ArrowUpRight, Building2, CalendarCheck, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eyebrow, SectionTitle } from "@/components/ui/page"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Alert, Skeleton } from "@/components/ui/states"
import { toMessage } from "@/features/companies/form-errors"
import { getCompany } from "@/features/companies/api"
import { activityTypeLabels } from "@/features/activities/activity-labels"
import { ActivityTimeline } from "@/features/activities/ActivityTimeline"
import { LogActivityForm } from "@/features/activities/LogActivityForm"
import { listActivitiesByDeal, type Activity, type LogActivityResult } from "@/features/activities/api"
import { MIN_SEARCH_LENGTH, search } from "@/features/search/api"
import { formatDue } from "@/lib/format"
import { useAsyncResource, useDebouncedValue } from "@/lib/hooks"
import { formatLocalDate, todayLocal } from "@/lib/local-date"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { DealDrawerSection } from "./deal-section"
import { DealForm } from "./DealForm"
import { StageHistory } from "./StageHistory"
import { CloseDealForm } from "./CloseDealForm"
import type { CloseOutcome } from "./close-deal"
import { getDeal, type Deal, type DealStage, type UserSummary } from "./api"
import { lostReasonLabels, sourceLabels, stageLabels, statusLabels } from "./stage-labels"

export type DealDrawerTarget =
  | { mode: "deal"; id: string; section?: DealDrawerSection }
  /** Sem empresa (o "+ Novo negócio" do Pipeline), o drawer pede a empresa primeiro. */
  | { mode: "new"; companyId?: string; companyName?: string; stage?: DealStage }
  | null

type Props = {
  target: DealDrawerTarget
  users: UserSummary[]
  onOpenChange: (open: boolean) => void
  onOpenCompany: (companyId: string) => void
  onSaved: () => void
  /** Negócio que o usuário acabou de mexer pela ficha (salvar, fechar, registrar) — o Pipeline não pulsa o eco. */
  onTouched?: (dealId: string) => void
  /** Admin/Closer: trocar o responsável na ficha é reatribuir (mesma regra do servidor). */
  canReassign: boolean
}

export function DealDrawer({ target, users, onOpenChange, onOpenCompany, onSaved, onTouched, canReassign }: Props) {
  const [deal, setDeal] = useState<Deal | null>(null)
  const [companyName, setCompanyName] = useState("")
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [closingAs, setClosingAs] = useState<CloseOutcome | null>(null)
  // Empresa escolhida no próprio drawer, quando ele abre em "novo" sem empresa. Vale só para o alvo atual.
  const [picked, setPicked] = useState<{ target: DealDrawerTarget; id: string; name: string } | null>(null)
  const pickedCompany = picked && picked.target === target ? picked : null
  const pickedCompanyId = pickedCompany?.id ?? null

  const [activities, setActivities] = useState<Activity[]>([])
  const [activitiesError, setActivitiesError] = useState<string | null>(null)
  const [lastNextAction, setLastNextAction] = useState<LogActivityResult["nextAction"]>(null)

  useEffect(() => {
    setClosingAs(null)

    if (!target) {
      setDeal(null)
      setActivities([])
      setLastNextAction(null)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setLoadError(null)

    const companyId = target.mode === "deal" ? null : (target.companyId ?? pickedCompanyId)
    if (target.mode === "new" && !companyId) {
      setDeal(null)
      setCompanyName("")
      setContacts([])
      setIsLoading(false)
      return
    }

    async function load() {
      try {
        if (target!.mode === "deal") {
          const loadedDeal = await getDeal(target!.id, controller.signal)
          const company = await getCompany(loadedDeal.companyId, controller.signal)
          setDeal(loadedDeal)
          setCompanyName(loadedDeal.companyName)
          setContacts(company.contacts.map((c) => ({ id: c.id, name: c.name })))
          await loadActivities(target!.id, controller.signal)
        } else {
          const company = await getCompany(companyId!, controller.signal)
          setDeal(null)
          setCompanyName(company.name)
          setContacts(company.contacts.map((c) => ({ id: c.id, name: c.name })))
          setActivities([])
        }
      } catch (err) {
        if (controller.signal.aborted) return
        setLoadError(toMessage(err, "Não foi possível carregar o negócio."))
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [target, pickedCompanyId])

  async function loadActivities(dealId: string, signal?: AbortSignal) {
    setActivitiesError(null)
    try {
      const items = await listActivitiesByDeal(dealId, signal)
      setActivities(items)
    } catch (err) {
      if (signal?.aborted) return
      setActivitiesError(toMessage(err, "Não foi possível carregar a timeline."))
    }
  }

  function handleSaved(saved: Deal) {
    setDeal(saved)
    onTouched?.(saved.id)
    onSaved()
  }

  function handleActivityLogged(result: LogActivityResult) {
    if (deal) onTouched?.(deal.id)
    setActivities((current) => [result.activity, ...current])
    setLastNextAction(result.nextAction)
  }

  const newCompanyId = target?.mode === "new" ? (target.companyId ?? pickedCompanyId) : null
  const openCompanyId = target?.mode === "deal" ? (deal?.companyId ?? null) : newCompanyId
  const isNew = target?.mode === "new"
  const needsCompany = isNew && newCompanyId === null
  const initialStage = target?.mode === "new" ? target.stage : undefined
  const isReady = !isLoading && !loadError && !needsCompany && (isNew || deal !== null)
  // Valor efetivo do servidor (`DealDto.Value`): a ficha e o cartão do quadro mostram o mesmo número.
  const value = deal?.value ?? null

  // Chegada em "Registrar atividade": quando o formulário existe, leva a rolagem e o foco ao primeiro campo.
  const logSectionRef = useRef<HTMLElement>(null)
  const opensAtActivity = target?.mode === "deal" && target.section === "activity"
  useEffect(() => {
    if (!isReady || !opensAtActivity) return
    const firstField = logSectionRef.current?.querySelector<HTMLElement>(
      '[role="radio"][tabindex="0"], input, select, textarea'
    )
    logSectionRef.current?.scrollIntoView({ block: "start" })
    firstField?.focus({ preventScroll: true })
  }, [isReady, opensAtActivity])

  return (
    <Sheet open={target !== null} onOpenChange={onOpenChange}>
      <SheetContent size="lg">
        <SheetHeader className="gap-3">
          <Eyebrow>{isNew ? "Novo negócio" : "Negócio"}</Eyebrow>
          <SheetTitle>{isNew ? companyName || "Novo negócio" : companyName || "Negócio"}</SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {isNew && initialStage && (
                <Badge variant="accent" dot>
                  Nasce em {stageLabels[initialStage]}
                </Badge>
              )}
              {deal && (
                <>
                  {deal.status === "Aberto" ? (
                    <Badge variant="accent" dot>
                      {stageLabels[deal.stage]}
                    </Badge>
                  ) : (
                    <Badge variant={deal.status === "Ganho" ? "success" : "danger"} dot>
                      {statusLabels[deal.status]}
                    </Badge>
                  )}
                </>
              )}
              {companyName && openCompanyId && (
                <button
                  type="button"
                  onClick={() => onOpenCompany(openCompanyId)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-xs text-sm text-fg-muted underline decoration-line-strong underline-offset-4 hover:text-fg hover:decoration-accent focus-visible:focus-ring"
                >
                  Ficha da empresa
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </SheetDescription>

          {deal && (
            <dl className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line-soft bg-line-soft sm:grid-cols-4">
              <Stat label="Valor">
                <span className={cn("tabular", value === null ? "text-faint" : deal.status === "Ganho" ? "text-success" : "text-fg")}>
                  {formatMoney(value)}
                  {deal.valueIsEstimated && (
                    <span className="ml-1 text-2xs text-muted" title="Valor estimado (ticket), ainda sem valor em negociação">
                      est.
                    </span>
                  )}
                </span>
              </Stat>
              <Stat label="Responsável">{deal.ownerUserName}</Stat>
              <Stat label="Contato">{deal.contactName ?? <span className="text-faint">—</span>}</Stat>
              <Stat label="Origem">{sourceLabels[deal.source]}</Stat>
              {/* Quinto item: linha própria, para não apertar valor e responsável nas colunas de cima. */}
              <Stat label="Previsão" className="col-span-2 sm:col-span-4">
                {deal.expectedCloseDate ? (
                  <span
                    className={cn(
                      "tabular",
                      deal.status === "Aberto" && deal.expectedCloseDate < todayLocal() ? "text-danger" : "text-fg"
                    )}
                  >
                    {formatLocalDate(deal.expectedCloseDate)}
                  </span>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </Stat>
              {deal.status === "Perdido" && (
                <Stat label="Motivo da perda" className="col-span-2 sm:col-span-4">
                  {deal.lostReason ? (
                    <span className="whitespace-normal">
                      {lostReasonLabels[deal.lostReason]}
                      {deal.lostNote && <span className="text-fg-muted"> · {deal.lostNote}</span>}
                    </span>
                  ) : (
                    <span className="text-faint">Não registrado</span>
                  )}
                </Stat>
              )}
            </dl>
          )}
        </SheetHeader>

        <SheetBody>
          {needsCompany && <CompanyPicker onPick={(company) => setPicked({ target, ...company })} />}

          {isLoading && <DrawerSkeleton />}

          {loadError && (
            <div className="p-6">
              <Alert>{loadError}</Alert>
            </div>
          )}

          {isReady && (
            <>
              {deal && (
                <DrawerSection ref={logSectionRef} id="deal-log-heading" title="Registrar atividade">
                  <LogActivityForm dealId={deal.id} contacts={contacts} onLogged={handleActivityLogged} />
                  {lastNextAction && (
                    <Alert tone="success" className="mt-4">
                      <CalendarCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
                      Próxima ação agendada: {activityTypeLabels[lastNextAction.type]} · {formatDue(lastNextAction.dueDate)}
                    </Alert>
                  )}
                </DrawerSection>
              )}

              {deal && (
                <DrawerSection id="deal-timeline-heading" title="Timeline" count={activities.length}>
                  {activitiesError && <Alert className="mb-4">{activitiesError}</Alert>}
                  <ActivityTimeline activities={activities} />
                </DrawerSection>
              )}

              <DrawerSection id="deal-data-heading" title="Dados do negócio">
                <DealForm
                  key={deal?.id ?? "new"}
                  companyId={newCompanyId ?? deal!.companyId}
                  contacts={contacts}
                  users={users}
                  deal={deal}
                  canReassign={canReassign}
                  initialStage={initialStage}
                  onSaved={handleSaved}
                />
              </DrawerSection>

              {deal && deal.status === "Aberto" && (
                <CloseSection deal={deal} closingAs={closingAs} onStartClosing={setClosingAs} onClosed={handleSaved} />
              )}

              {deal && (
                <DrawerSection id="deal-history-heading" title="Histórico de estágios">
                  <StageHistory history={deal.stageHistory} users={users} />
                </DrawerSection>
              )}
            </>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

function Stat({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 bg-surface px-3 py-2.5", className)}>
      <dt className="label-mono text-faint">{label}</dt>
      <dd className="truncate text-base text-fg">{children}</dd>
    </div>
  )
}

function DrawerSection({
  ref,
  id,
  title,
  count,
  children,
  className,
}: {
  ref?: Ref<HTMLElement>
  id: string
  title: string
  count?: number
  children: ReactNode
  className?: string
}) {
  return (
    <section ref={ref} aria-labelledby={id} className={cn("flex flex-col gap-4 border-b border-line-soft px-5 py-6 last:border-b-0 sm:px-6", className)}>
      <SectionTitle id={id} as="h3" count={count}>
        {title}
      </SectionTitle>
      {children}
    </section>
  )
}

function DrawerSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-4 px-6 py-6">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-3 w-32" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-20" />
        ))}
      </div>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="mt-4 h-3 w-24" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

function CloseSection({
  deal,
  closingAs,
  onStartClosing,
  onClosed,
}: {
  deal: Deal
  closingAs: CloseOutcome | null
  onStartClosing: (value: CloseOutcome | null) => void
  onClosed: (deal: Deal) => void
}) {
  return (
    <DrawerSection id="deal-close-heading" title="Fechar negócio">
      {closingAs === null && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">Encerrar tira o negócio do funil e registra o desfecho.</p>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="hover:border-success hover:bg-success/10 hover:text-success"
              onClick={() => onStartClosing("won")}
            >
              Marcar ganho
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => onStartClosing("lost")}>
              Marcar perdido
            </Button>
          </div>
        </div>
      )}

      {closingAs !== null && (
        <div className={cn("flex flex-col gap-4 border-l-2 py-1 pl-4", closingAs === "won" ? "border-success" : "border-danger")}>
          <p className="text-base text-fg">
            {closingAs === "won" ? "Confirmar o negócio como ganho." : "Confirmar o negócio como perdido."}
          </p>
          <CloseDealForm
            key={closingAs}
            dealId={deal.id}
            outcome={closingAs}
            defaultAmount={deal.value}
            onClosed={(closed) => {
              onClosed(closed)
              onStartClosing(null)
            }}
            onCancel={() => onStartClosing(null)}
          />
        </div>
      )}
    </DrawerSection>
  )
}

/** Primeiro passo do "Novo negócio" sem empresa: a busca global, só empresas. */
function CompanyPicker({ onPick }: { onPick: (company: { id: string; name: string }) => void }) {
  const [query, setQuery] = useState("")
  const term = useDebouncedValue(query.trim(), 250)
  const results = useAsyncResource((signal) => search(term, signal), [term], { enabled: term.length >= MIN_SEARCH_LENGTH })
  const companies = results.data?.companies ?? []

  return (
    <DrawerSection id="deal-company-heading" title="Empresa">
      <label className="flex items-center gap-2 rounded-sm border border-line-soft bg-surface px-3 focus-within:border-line-strong has-[input:focus-visible]:focus-ring">
        <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
        <span className="sr-only">Buscar empresa</span>
        <input
          type="search"
          name="empresa-busca"
          autoFocus
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome da empresa…"
          className="h-10 min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-muted"
        />
      </label>
      <div aria-live="polite" className="flex flex-col gap-1">
        {term.length < MIN_SEARCH_LENGTH ? (
          <p className="text-sm text-muted">Digite ao menos {MIN_SEARCH_LENGTH} letras. O negócio nasce ligado a uma empresa já cadastrada.</p>
        ) : results.isLoading ? (
          <p className="text-sm text-muted">Buscando…</p>
        ) : results.error ? (
          <p className="text-sm text-danger">Não foi possível buscar agora. Tente de novo.</p>
        ) : companies.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma empresa com esse nome. Cadastre-a em Empresas primeiro.</p>
        ) : (
          <ul aria-label="Empresas encontradas" className="flex flex-col gap-1">
            {companies.map((company) => (
              <li key={company.id}>
                <button
                  type="button"
                  onClick={() => onPick({ id: company.id, name: company.name })}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 text-left transition-colors hover:bg-surface-2 focus-visible:focus-ring"
                >
                  <Building2 className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base text-fg">{company.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {[company.segment, company.city].filter(Boolean).join(" · ") || "Sem segmento"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DrawerSection>
  )
}
