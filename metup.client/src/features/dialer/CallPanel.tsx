import { type FormEvent, useEffect, useRef, useState } from "react"
import { AtSign, ExternalLink, Globe, Loader2, MapPin, MessageCircle, Phone, SkipForward, Star } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChoiceChips } from "@/components/ui/choice-chips"
import { Kbd } from "@/components/ui/command-palette"
import { FieldShell } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { InlineError } from "@/components/ui/states"
import { logActivity, type ActivityOutcome, type ActivityType } from "@/features/activities/api"
import { ALL_OUTCOMES, activityOutcomeLabels, activityTypeLabels } from "@/features/activities/activity-labels"
import { toMessage } from "@/features/companies/form-errors"
import { changeDealStageForBoard, closeDeal, type LostReason } from "@/features/deals/api"
import { LOST_REASONS, lostReasonLabels, stageLabels } from "@/features/deals/stage-labels"
import { instagramHref, whatsAppHref } from "@/lib/contact-links"
import { formatDateTime, formatOverdue, numberFormatter } from "@/lib/format"
import { shortcutKey } from "@/lib/shortcuts"
import { cn } from "@/lib/utils"
import type { DialerPhoneKind, DialerQueueItem, PhoneLine } from "./api"
import { channelFor } from "./call-channel"
import { businessDaysFrom, outcomeKey, OUTCOME_KEYS, suggestedFollowUp, suggestedStage, type FollowUpKind } from "./dialer-rules"

export type CallSaved = { outcome: ActivityOutcome; warning: string | null }

const NOTE_MAX_LENGTH = 500

const phoneKindLabels: Record<DialerPhoneKind, string> = {
  Contact: "Contato",
  ContactWhatsApp: "WhatsApp do contato",
  Company: "Empresa",
}

const followUpChoices: { value: FollowUpKind; label: string }[] = [
  { value: "next", label: "Agendar próxima ação" },
  { value: "lost", label: "Encerrar como perdido" },
  { value: "none", label: "Nada agora" },
]

const nextTypeChoices = (["Call", "WhatsApp", "Meeting"] as ActivityType[]).map((value) => ({ value, label: activityTypeLabels[value] }))

const dueShortcuts = [
  { label: "Amanhã", days: 1 },
  { label: "Em 2 dias úteis", days: 2 },
  { label: "Próxima semana", days: 5 },
]

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}

/**
 * Uma ligação da sessão: ligar, marcar o desfecho, decidir o próximo passo e seguir. Remontado a
 * cada lead (`key`), então todo estado aqui é da ligação atual.
 *
 * Atalhos (fora de campos de texto): <kbd>L</kbd> liga, <kbd>1</kbd>–<kbd>7</kbd> marcam o desfecho,
 * <kbd>P</kbd> pula. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> salva de qualquer lugar; Enter na nota também.
 *
 * Salvar registra a ligação (concluindo a tarefa da fila e criando a próxima ação na mesma
 * gravação). Mover o estágio ou encerrar vem depois: se falhar, a ligação já está salva e o aviso
 * volta para a tela.
 */
export function CallPanel({
  item,
  line,
  position,
  total,
  onSaved,
  onSkip,
  onOpenDeal,
}: {
  item: DialerQueueItem
  line: PhoneLine | null
  position: number
  total: number
  onSaved: (saved: CallSaved) => void
  onSkip: () => void
  onOpenDeal: (dealId: string) => void
}) {
  const firstDialable = Math.max(0, item.phones.findIndex((phone) => phone.dial))
  const [phoneIndex, setPhoneIndex] = useState(firstDialable)
  const [calledAt, setCalledAt] = useState<Date | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [outcome, setOutcome] = useState<ActivityOutcome | "">("")
  const [followKind, setFollowKind] = useState<FollowUpKind>("none")
  const [nextType, setNextType] = useState<ActivityType>("Call")
  const [nextDue, setNextDue] = useState(() => toLocalInputValue(businessDaysFrom(new Date(), 1)))
  const [lostReason, setLostReason] = useState<LostReason>("SemInteresse")
  const [lostNote, setLostNote] = useState("")
  const [moveStage, setMoveStage] = useState(true)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const dialButton = useRef<HTMLButtonElement>(null)
  const outcomeGroup = useRef<HTMLDivElement>(null)

  const phone = item.phones[phoneIndex] ?? null
  const canDial = Boolean(line && phone?.dial)
  const stageTarget = outcome ? suggestedStage(item.stage, outcome) : null
  const whatsApp = phone ? whatsAppHref(phone.display) : null
  const overdue = item.isOverdue ? formatOverdue(item.dueDate) : null

  // O próximo lead chega com o foco em "Ligar": Enter (ou L) já disca.
  useEffect(() => {
    dialButton.current?.focus()
  }, [])

  useEffect(() => {
    if (!calledAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [calledAt])

  function dial() {
    if (!line || !phone?.dial) return
    channelFor(line.kind).dial(phone.dial)
    setCalledAt(new Date())
    setNow(Date.now())
  }

  function chooseOutcome(next: ActivityOutcome) {
    setOutcome(next)
    setError(null)
    const suggestion = suggestedFollowUp(next, new Date())
    setFollowKind(suggestion.kind)
    if (suggestion.kind === "next") {
      setNextType(suggestion.type)
      setNextDue(toLocalInputValue(suggestion.due))
    }
    if (suggestion.kind === "lost") {
      setLostReason(suggestion.reason)
      setLostNote(suggestion.note ?? "")
    }
    setMoveStage(true)
  }

  async function save() {
    if (saving) return
    if (!outcome) {
      setError("Marque o desfecho da ligação (teclas 1 a 7).")
      outcomeGroup.current?.querySelector<HTMLButtonElement>("[role=radio]")?.focus()
      return
    }

    setSaving(true)
    setError(null)
    try {
      await logActivity(item.dealId, {
        contactId: phone && phone.kind !== "Company" ? item.contactId : null,
        type: "Call",
        outcome,
        note: note.trim() || null,
        occurredAt: (calledAt ?? new Date()).toISOString(),
        nextActionType: followKind === "next" ? nextType : null,
        nextActionDueDate: followKind === "next" ? new Date(nextDue).toISOString() : null,
        nextActionNote: null,
        completesTaskId: item.taskId,
        ...(line ? { phoneLineId: line.id } : {}),
      })
    } catch (err) {
      setError(toMessage(err, "Não foi possível registrar a ligação."))
      setSaving(false)
      return
    }

    let warning: string | null = null
    try {
      if (followKind === "lost") {
        await closeDeal(item.dealId, false, null, lostReason, lostNote)
      } else if (moveStage && stageTarget) {
        await changeDealStageForBoard(item.dealId, stageTarget, { expectedFromStage: item.stage })
      }
    } catch (err) {
      const what = followKind === "lost" ? "o negócio não foi encerrado" : "o estágio não mudou"
      warning = `Ligação de ${item.companyName} registrada, mas ${what}: ${toMessage(err, "erro inesperado")}`
    }

    onSaved({ outcome, warning })
  }

  // Atalhos da sessão. O handler mais recente fica na ref: o listener é assinado uma vez só.
  const shortcuts = useRef({ dial, chooseOutcome, save, onSkip })
  useEffect(() => {
    shortcuts.current = { dial, chooseOutcome, save, onSkip }
  })
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault()
        void shortcuts.current.save()
        return
      }
      const key = shortcutKey(event)
      if (!key) return
      if (OUTCOME_KEYS[key]) {
        event.preventDefault()
        shortcuts.current.chooseOutcome(OUTCOME_KEYS[key])
      } else if (key === "l") {
        event.preventDefault()
        shortcuts.current.dial()
      } else if (key === "p") {
        event.preventDefault()
        shortcuts.current.onSkip()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void save()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6" aria-labelledby="call-company">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="label-mono text-faint tabular">
            Ligação {numberFormatter.format(position)} de {numberFormatter.format(total)}
          </p>
          <h2 id="call-company" className="font-display text-xl font-semibold tracking-[-0.01em] text-fg">
            {item.companyName}
          </h2>
          {(item.contactName || item.segment || item.city) && (
            <p className="text-sm text-fg-muted">
              {[item.contactName && (item.contactRole ? `${item.contactName} (${item.contactRole})` : item.contactName), item.segment, item.city]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="outline">{stageLabels[item.stage]}</Badge>
            {overdue && <Badge variant="danger">Atrasada {overdue}</Badge>}
            {item.callHistory.attempts > 0 && (
              <Badge>
                {item.callHistory.attempts + 1}ª tentativa
                {item.callHistory.lastOutcome && ` · antes: ${activityOutcomeLabels[item.callHistory.lastOutcome].toLowerCase()}`}
              </Badge>
            )}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onOpenDeal(item.dealId)}>
          <ExternalLink aria-hidden="true" />
          Abrir negócio
        </Button>
      </header>

      <section aria-label="Telefones" className="flex flex-col gap-3 rounded-sm border border-line-soft bg-surface-2/40 p-4">
        {item.phones.length === 0 ? (
          <p className="text-sm text-muted">Nenhum telefone cadastrado. Abra o negócio para incluir um, ou marque “Número inválido”.</p>
        ) : (
          <div role="radiogroup" aria-label="Número para ligar" className="flex flex-col gap-1.5">
            {item.phones.map((option, index) => (
              <label
                key={`${option.kind}-${option.display}`}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xs border px-3 py-2 text-sm transition-colors",
                  index === phoneIndex ? "border-accent/50 bg-accent/5" : "border-transparent hover:bg-surface-2",
                  !option.dial && "cursor-default opacity-60"
                )}
              >
                <input
                  type="radio"
                  name="dial-phone"
                  checked={index === phoneIndex}
                  disabled={!option.dial}
                  onChange={() => setPhoneIndex(index)}
                  className="size-4 accent-accent"
                />
                <span className="font-mono text-base text-fg tabular">{option.display}</span>
                <span className="text-xs text-muted">{phoneKindLabels[option.kind]}</span>
                {!option.dial && <span className="text-xs text-danger">sem DDD — não dá para discar</span>}
              </label>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button ref={dialButton} type="button" size="lg" onClick={dial} disabled={!canDial} className="min-w-44">
            <Phone aria-hidden="true" />
            {calledAt ? "Ligar de novo" : "Ligar"}
            <Kbd className="ml-1 border-black/20 bg-black/10 text-on-accent">L</Kbd>
          </Button>
          {whatsApp && (
            <Button asChild variant="outline" size="lg">
              <a href={whatsApp} target="_blank" rel="noreferrer">
                <MessageCircle aria-hidden="true" />
                WhatsApp
              </a>
            </Button>
          )}
          <p aria-live="polite" className="text-sm text-fg-muted">
            {!line
              ? "Sem linha cadastrada — peça ao administrador."
              : calledAt
                ? `Chamando pelo ${line.label} · ${formatElapsed(now - calledAt.getTime())} — marque o desfecho ao desligar.`
                : `Sai pelo ${line.label} (${line.number}).`}
          </p>
        </div>
      </section>

      <LeadContext item={item} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-fg">
          Desfecho <span className="text-danger">*</span>
        </legend>
        <div ref={outcomeGroup} role="radiogroup" aria-label="Desfecho da ligação" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {ALL_OUTCOMES.map((value) => {
            const checked = outcome === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => chooseOutcome(value)}
                className={cn(
                  "flex h-10 cursor-pointer items-center justify-between gap-2 rounded-xs border px-3 text-sm transition-colors focus-visible:focus-ring",
                  checked ? "border-accent/60 bg-accent/10 text-fg" : "border-line-soft bg-surface-2 text-fg-muted hover:border-line-strong hover:text-fg"
                )}
              >
                {activityOutcomeLabels[value]}
                <Kbd>{outcomeKey(value)}</Kbd>
              </button>
            )
          })}
        </div>
      </fieldset>

      {outcome && (
        <div className="flex flex-col gap-4 rounded-sm border border-line-soft p-4">
          <ChoiceChips id="follow-kind" label="Próximo passo" options={followUpChoices} value={followKind} onChange={setFollowKind} />

          {followKind === "next" && (
            <div className="flex flex-col gap-3">
              <ChoiceChips id="next-type" label="Tipo da próxima ação" options={nextTypeChoices} value={nextType} onChange={setNextType} />
              <div className="flex flex-wrap items-center gap-2">
                {dueShortcuts.map((shortcut) => (
                  <Button
                    key={shortcut.label}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setNextDue(toLocalInputValue(businessDaysFrom(new Date(), shortcut.days)))}
                  >
                    {shortcut.label}
                  </Button>
                ))}
                <label className="sr-only" htmlFor="next-due">
                  Data e hora da próxima ação
                </label>
                <Input id="next-due" type="datetime-local" value={nextDue} onChange={(e) => setNextDue(e.target.value)} autoComplete="off" className="h-8 w-auto" />
              </div>
            </div>
          )}

          {followKind === "lost" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldShell id="lost-reason" label="Motivo">
                <Select id="lost-reason" value={lostReason} onChange={(e) => setLostReason(e.target.value as LostReason)}>
                  {LOST_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {lostReasonLabels[reason]}
                    </option>
                  ))}
                </Select>
              </FieldShell>
              <FieldShell id="lost-note" label="Complemento">
                <Input id="lost-note" value={lostNote} maxLength={280} onChange={(e) => setLostNote(e.target.value)} placeholder="Opcional…" autoComplete="off" />
              </FieldShell>
            </div>
          )}

          {followKind !== "lost" && stageTarget && (
            <label className="flex cursor-pointer items-center gap-3 text-sm text-fg">
              <input type="checkbox" checked={moveStage} onChange={(e) => setMoveStage(e.target.checked)} className="size-4 accent-accent" />
              Mover de {stageLabels[item.stage]} para <strong className="font-medium">{stageLabels[stageTarget]}</strong>
            </label>
          )}
        </div>
      )}

      <FieldShell id="call-note" label="Observação" hint="Uma linha. Enter salva e vai para o próximo.">
        <Input id="call-note" value={note} maxLength={NOTE_MAX_LENGTH} onChange={(e) => setNote(e.target.value)} autoComplete="off" />
      </FieldShell>

      <div aria-live="polite" className="empty:hidden">
        {error && <InlineError>{error}</InlineError>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-4">
        <Button type="button" variant="ghost" onClick={onSkip} disabled={saving}>
          <SkipForward aria-hidden="true" />
          Pular
          <Kbd>P</Kbd>
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {saving ? "Salvando…" : "Salvar e próximo"}
          {!saving && <Kbd className="ml-1 border-black/20 bg-black/10 text-on-accent">Ctrl ↵</Kbd>}
        </Button>
      </div>
    </form>
  )
}

/** O que o SDR lê enquanto chama: de onde veio o lead, nota no Maps, endereço, links e a nota da tarefa. */
function LeadContext({ item }: { item: DialerQueueItem }) {
  const lead = item.lead
  const instagram = instagramHref(item.instagram)
  const links = [
    lead?.mapsUrl && { href: lead.mapsUrl, label: "Maps", icon: MapPin },
    item.website && { href: /^https?:\/\//i.test(item.website) ? item.website : `https://${item.website}`, label: "Site", icon: Globe },
    instagram && { href: instagram, label: "Instagram", icon: AtSign },
  ].filter((link): link is { href: string; label: string; icon: typeof MapPin } => Boolean(link))

  if (!lead && links.length === 0 && !item.taskNote && !item.callHistory.lastCallAt) return null

  return (
    <section aria-label="Contexto do lead" className="flex flex-col gap-2 text-sm text-fg-muted">
      {lead && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {lead.rating !== null && (
            <span className="inline-flex items-center gap-1 text-fg">
              <Star className="size-3.5 fill-accent text-accent" aria-hidden="true" />
              {lead.rating.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
              {lead.reviewCount !== null && <span className="text-muted">({numberFormatter.format(lead.reviewCount)} avaliações)</span>}
            </span>
          )}
          {lead.category && <span>{lead.category}</span>}
          <span className="text-muted">
            Busca “{lead.searchQuery}”{lead.searchLocation ? ` em ${lead.searchLocation}` : ""}
          </span>
        </p>
      )}
      {lead?.address && <p>{lead.address}</p>}
      {item.taskNote && <p className="text-muted">Tarefa: {item.taskNote}</p>}
      {item.callHistory.lastCallAt && (
        <p className="text-muted">Última ligação: {formatDateTime(item.callHistory.lastCallAt)}</p>
      )}
      {links.length > 0 && (
        <p className="flex flex-wrap gap-3">
          {links.map(({ href, label, icon: Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-accent underline decoration-line-strong underline-offset-4 hover:decoration-accent focus-visible:focus-ring"
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </a>
          ))}
        </p>
      )}
    </section>
  )
}
