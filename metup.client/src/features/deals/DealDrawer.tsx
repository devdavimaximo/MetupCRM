import { useEffect, useState } from "react"
import { Building2, CalendarClock, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { toMessage } from "@/features/companies/form-errors"
import { getCompany } from "@/features/companies/api"
import { activityTypeLabels } from "@/features/activities/activity-labels"
import { ActivityTimeline } from "@/features/activities/ActivityTimeline"
import { LogActivityForm } from "@/features/activities/LogActivityForm"
import { listActivitiesByDeal, type Activity, type LogActivityResult } from "@/features/activities/api"
import { formatMoney, parseMoney } from "@/lib/money"
import { DealForm } from "./DealForm"
import { StageHistory } from "./StageHistory"
import { closeDeal, getDeal, type Deal, type UserSummary } from "./api"
import { stageLabels, statusLabels } from "./stage-labels"

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

  return (
    <Sheet open={target !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{target?.mode === "deal" ? companyName || "Negócio" : "Novo negócio"}</SheetTitle>
          <SheetDescription>
            {companyName && openCompanyId && (
              <button
                type="button"
                onClick={() => onOpenCompany(openCompanyId)}
                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
              >
                <Building2 className="size-3.5" aria-hidden="true" />
                Ver ficha da empresa
              </button>
            )}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          {isLoading && (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Carregando…
            </p>
          )}

          {loadError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {loadError}
            </p>
          )}

          {!isLoading && !loadError && (target?.mode === "new" || deal) && (
            <>
              {deal && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={deal.status === "Ganho" ? "success" : deal.status === "Perdido" ? "outline" : "outline"}>
                    {statusLabels[deal.status]}
                  </Badge>
                  <Badge variant="outline">{stageLabels[deal.stage]}</Badge>
                </div>
              )}

              <section aria-labelledby="deal-data-heading" className="flex flex-col gap-3">
                <h3 id="deal-data-heading" className="text-sm font-semibold text-foreground">
                  Dados do negócio
                </h3>
                <DealForm
                  key={deal?.id ?? "new"}
                  companyId={target?.mode === "new" ? target.companyId : deal!.companyId}
                  contacts={contacts}
                  users={users}
                  deal={deal}
                  onSaved={handleSaved}
                />
              </section>

              {deal && deal.status === "Aberto" && (
                <CloseSection
                  deal={deal}
                  closingAs={closingAs}
                  onStartClosing={setClosingAs}
                  onClosed={handleSaved}
                />
              )}

              {deal && (
                <section aria-labelledby="deal-log-heading" className="flex flex-col gap-3">
                  <h3 id="deal-log-heading" className="text-sm font-semibold text-foreground">
                    Registrar atividade
                  </h3>
                  <LogActivityForm dealId={deal.id} contacts={contacts} onLogged={handleActivityLogged} />
                  {lastNextAction && (
                    <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
                      Próxima ação agendada: {activityTypeLabels[lastNextAction.type]} em{" "}
                      {new Date(lastNextAction.dueDate).toLocaleString("pt-BR")}.
                    </p>
                  )}
                </section>
              )}

              {deal && (
                <section aria-labelledby="deal-timeline-heading" className="flex flex-col gap-3">
                  <h3 id="deal-timeline-heading" className="text-sm font-semibold text-foreground">
                    Timeline
                  </h3>
                  {activitiesError && (
                    <p role="alert" className="text-sm font-medium text-destructive">
                      {activitiesError}
                    </p>
                  )}
                  <ActivityTimeline activities={activities} />
                </section>
              )}

              {deal && (
                <section aria-labelledby="deal-history-heading" className="flex flex-col gap-3">
                  <h3 id="deal-history-heading" className="text-sm font-semibold text-foreground">
                    Histórico de estágios
                  </h3>
                  <StageHistory history={deal.stageHistory} users={users} />
                </section>
              )}
            </>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
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
    <section aria-labelledby="deal-close-heading" className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4">
      <h3 id="deal-close-heading" className="text-sm font-semibold text-foreground">
        Fechar negócio
      </h3>

      {closingAs === null && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => onStartClosing("won")}>
            Marcar como Ganho
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onStartClosing("lost")}>
            Marcar como Perdido
          </Button>
        </div>
      )}

      {closingAs !== null && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deal-closed-amount">
              Valor {closingAs === "won" ? "fechado" : "final"}
            </Label>
            <Input
              id="deal-closed-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
            <p className="text-xs text-muted-foreground">{amount ? formatMoney(parseMoney(amount)) : "Sem valor definido."}</p>
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={isClosing} onClick={confirmClose}>
              {isClosing && <Loader2 className="animate-spin" aria-hidden="true" />}
              Confirmar {closingAs === "won" ? "ganho" : "perda"}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={isClosing} onClick={() => onStartClosing(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
