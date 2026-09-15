import { useEffect, useState, type ReactNode } from "react"
import { ArrowUpRight, CalendarCheck, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Eyebrow, SectionTitle } from "@/components/ui/page"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Alert, InlineError, Skeleton } from "@/components/ui/states"
import { toMessage } from "@/features/companies/form-errors"
import { getCompany } from "@/features/companies/api"
import { activityTypeLabels } from "@/features/activities/activity-labels"
import { ActivityTimeline } from "@/features/activities/ActivityTimeline"
import { LogActivityForm } from "@/features/activities/LogActivityForm"
import { listActivitiesByDeal, type Activity, type LogActivityResult } from "@/features/activities/api"
import { formatDue } from "@/lib/format"
import { formatLocalDate, todayLocal } from "@/lib/local-date"
import { formatMoney, parseMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import { DealForm } from "./DealForm"
import { StageHistory } from "./StageHistory"
import { closeDeal, getDeal, type Deal, type UserSummary } from "./api"
import { sourceLabels, stageLabels, statusLabels } from "./stage-labels"

export type DealDrawerTarget =
  | { mode: "deal"; id: string }
  | { mode: "new"; companyId: string; companyName: string }
  | null

type Props = {
  target: DealDrawerTarget
  users: UserSummary[]
  onOpenChange: (open: boolean) => void
  onOpenCompany: (companyId: string) => void
  onSaved: () => void
}

export function DealDrawer({ target, users, onOpenChange, onOpenCompany, onSaved }: Props) {
  const [deal, setDeal] = useState<Deal | null>(null)
  const [companyName, setCompanyName] = useState("")
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [closingAs, setClosingAs] = useState<"won" | "lost" | null>(null)

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

    const companyId = target.mode === "deal" ? null : target.companyId

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
  }, [target])

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
    onSaved()
  }

  function handleActivityLogged(result: LogActivityResult) {
    setActivities((current) => [result.activity, ...current])
    setLastNextAction(result.nextAction)
  }

  const openCompanyId = target?.mode === "deal" ? (deal?.companyId ?? null) : (target?.companyId ?? null)
  const isNew = target?.mode === "new"
  const isReady = !isLoading && !loadError && (isNew || deal)
  const value = deal ? (deal.amount ?? deal.ticket) : null

  return (
    <Sheet open={target !== null} onOpenChange={onOpenChange}>
      <SheetContent size="lg">
        <SheetHeader className="gap-3">
          <Eyebrow>{isNew ? "Novo negócio" : "Negócio"}</Eyebrow>
          <SheetTitle>{isNew ? companyName || "Novo negócio" : companyName || "Negócio"}</SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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
            </dl>
          )}
        </SheetHeader>

        <SheetBody>
          {isLoading && <DrawerSkeleton />}

          {loadError && (
            <div className="p-6">
              <Alert>{loadError}</Alert>
            </div>
          )}

          {isReady && (
            <>
              {deal && (
                <DrawerSection id="deal-log-heading" title="Registrar atividade">
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
                  companyId={target?.mode === "new" ? target.companyId : deal!.companyId}
                  contacts={contacts}
                  users={users}
                  deal={deal}
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
  id,
  title,
  count,
  children,
  className,
}: {
  id: string
  title: string
  count?: number
  children: ReactNode
  className?: string
}) {
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-4 border-b border-line-soft px-5 py-6 last:border-b-0 sm:px-6", className)}>
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
  closingAs: "won" | "lost" | null
  onStartClosing: (value: "won" | "lost" | null) => void
  onClosed: (deal: Deal) => void
}) {
  const [amount, setAmount] = useState(() => String(deal.amount ?? deal.ticket ?? ""))
  const [isClosing, setIsClosing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmClose() {
    if (!closingAs) return
    setIsClosing(true)
    setError(null)

    try {
      const closed = await closeDeal(deal.id, closingAs === "won", parseMoney(amount))
      onClosed(closed)
      onStartClosing(null)
    } catch (err) {
      setError(toMessage(err, "Não foi possível fechar o negócio."))
    } finally {
      setIsClosing(false)
    }
  }

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
        <div
          className={cn(
            "flex flex-col gap-4 border-l-2 py-1 pl-4",
            closingAs === "won" ? "border-success" : "border-danger"
          )}
        >
          <p className="text-base text-fg">
            {closingAs === "won" ? "Confirmar o negócio como ganho." : "Confirmar o negócio como perdido."}
          </p>
          <Field
            id="deal-closed-amount"
            label={closingAs === "won" ? "Valor fechado" : "Valor final"}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            hint={amount ? formatMoney(parseMoney(amount)) : "Sem valor definido."}
            className="sm:max-w-xs"
          />

          {error && <InlineError>{error}</InlineError>}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={closingAs === "won" ? "default" : "destructive"}
              disabled={isClosing}
              onClick={confirmClose}
            >
              {isClosing && <Loader2 className="animate-spin" aria-hidden="true" />}
              Confirmar {closingAs === "won" ? "ganho" : "perda"}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={isClosing} onClick={() => onStartClosing(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </DrawerSection>
  )
}
