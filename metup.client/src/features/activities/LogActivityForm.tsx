import { type FormEvent, useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ChoiceChips } from "@/components/ui/choice-chips"
import { FieldShell, SelectField, fieldDescribedBy } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InlineError } from "@/components/ui/states"
import { Textarea } from "@/components/ui/textarea"
import { toFieldErrors, toMessage } from "@/features/companies/form-errors"
import { cn } from "@/lib/utils"
import { activityTypeIcons } from "./activity-icons"
import { logActivity, type ActivityOutcome, type ActivityType, type LogActivityResult } from "./api"
import { ALL_OUTCOMES, NEXT_ACTION_TYPES, activityOutcomeLabels, activityTypeLabels } from "./activity-labels"

const MAX_NOTE_LENGTH = 500

type Props = {
  dealId: string
  contacts: { id: string; name: string }[]
  onLogged: (result: LogActivityResult) => void
  /** Tipo já marcado ao abrir (ex.: o tipo da tarefa de origem). */
  initialType?: ActivityType
  /** Conclui esta tarefa na mesma gravação da atividade (tela de Tarefas). */
  completesTaskId?: string
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function defaultNextActionDueDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(9, 0, 0, 0)
  return toLocalInputValue(date)
}

const typeChoices = (Object.keys(activityTypeLabels) as ActivityType[]).map((value) => ({
  value,
  label: activityTypeLabels[value],
  icon: activityTypeIcons[value],
}))

const outcomeChoices = ALL_OUTCOMES.map((value) => ({ value, label: activityOutcomeLabels[value] }))

/**
 * Formulário de "registrar é rápido" (seção 3 do CLAUDE.md): tipo + desfecho estruturado + nota
 * curta, em toques — chips em vez de selects. A próxima ação fica atrás de um toggle.
 */
export function LogActivityForm({ dealId, contacts, onLogged, initialType = "Call", completesTaskId }: Props) {
  const [type, setType] = useState<ActivityType>(initialType)
  const [outcome, setOutcome] = useState<ActivityOutcome | "">("")
  const [contactId, setContactId] = useState("")
  const [note, setNote] = useState("")
  const [scheduleNext, setScheduleNext] = useState(false)
  const [nextActionType, setNextActionType] = useState<ActivityType>("Call")
  const [nextActionDueDate, setNextActionDueDate] = useState(() => defaultNextActionDueDate())
  const [nextActionNote, setNextActionNote] = useState("")

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const needsOutcome = type === "Call"

  function resetAfterSubmit() {
    setNote("")
    setOutcome("")
    setScheduleNext(false)
    setNextActionNote("")
    setNextActionDueDate(defaultNextActionDueDate())
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setFieldErrors({})

    try {
      const result = await logActivity(dealId, {
        contactId: contactId || null,
        type,
        outcome: outcome || null,
        note: note || null,
        occurredAt: null,
        nextActionType: scheduleNext ? nextActionType : null,
        nextActionDueDate: scheduleNext ? new Date(nextActionDueDate).toISOString() : null,
        nextActionNote: scheduleNext ? nextActionNote || null : null,
        ...(completesTaskId ? { completesTaskId } : {}),
      })
      onLogged(result)
      resetAfterSubmit()
    } catch (err) {
      const errors = toFieldErrors(err)
      setFieldErrors(errors)
      setError(Object.keys(errors).length ? null : toMessage(err, "Não foi possível registrar a atividade."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <FieldShell id="activity-type" label="Tipo" required error={fieldErrors.type}>
        <ChoiceChips
          id="activity-type"
          label="Tipo da atividade"
          options={typeChoices}
          value={type}
          invalid={Boolean(fieldErrors.type)}
          describedBy={fieldDescribedBy("activity-type", fieldErrors.type)}
          onChange={(next) => {
            setType(next)
            if (next !== "Call") setOutcome("")
          }}
        />
      </FieldShell>

      {needsOutcome && (
        <FieldShell id="activity-outcome" label="Desfecho da ligação" required error={fieldErrors.outcome}>
          <ChoiceChips
            id="activity-outcome"
            label="Desfecho da ligação"
            options={outcomeChoices}
            value={outcome}
            invalid={Boolean(fieldErrors.outcome)}
            describedBy={fieldDescribedBy("activity-outcome", fieldErrors.outcome)}
            onChange={setOutcome}
          />
        </FieldShell>
      )}

      {contacts.length > 0 && (
        <SelectField
          id="activity-contact"
          label="Contato"
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          error={fieldErrors.contactId}
        >
          <option value="">Sem contato específico</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.name}
            </option>
          ))}
        </SelectField>
      )}

      <FieldShell
        id="activity-note"
        label="Nota"
        error={fieldErrors.note}
        hint={
          <span className="flex justify-between gap-2">
            <span>Uma linha curta — o desfecho já diz o principal.</span>
            <span className="tabular">
              {note.length}/{MAX_NOTE_LENGTH}
            </span>
          </span>
        }
      >
        <Textarea
          id="activity-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          rows={2}
          aria-invalid={fieldErrors.note ? true : undefined}
          aria-describedby={fieldDescribedBy("activity-note", fieldErrors.note, true)}
        />
      </FieldShell>

      <div className={cn("flex flex-col rounded-sm border", scheduleNext ? "border-line-strong/60 bg-surface-2/40" : "border-line-soft")}>
        <label className="flex cursor-pointer items-center gap-3 px-4 py-3 text-base text-fg">
          <input
            type="checkbox"
            checked={scheduleNext}
            onChange={(e) => setScheduleNext(e.target.checked)}
            className="size-4 cursor-pointer accent-accent"
          />
          <span className="flex-1">
            Agendar a próxima ação
            <span className="block text-xs text-muted">Cai direto na fila de follow-ups do responsável.</span>
          </span>
        </label>

        {scheduleNext && (
          <div className="grid gap-4 border-t border-line-soft px-4 pt-4 pb-4 sm:grid-cols-2">
            <SelectField
              id="next-action-type"
              label="Próxima ação"
              required
              value={nextActionType}
              onChange={(e) => setNextActionType(e.target.value as ActivityType)}
              error={fieldErrors.nextActionType}
            >
              {NEXT_ACTION_TYPES.map((value) => (
                <option key={value} value={value}>
                  {activityTypeLabels[value]}
                </option>
              ))}
            </SelectField>

            <FieldShell id="next-action-due-date" label="Quando" required error={fieldErrors.nextActionDueDate}>
              <Input
                id="next-action-due-date"
                type="datetime-local"
                required={scheduleNext}
                value={nextActionDueDate}
                onChange={(e) => setNextActionDueDate(e.target.value)}
                aria-invalid={fieldErrors.nextActionDueDate ? true : undefined}
                aria-describedby={fieldDescribedBy("next-action-due-date", fieldErrors.nextActionDueDate)}
              />
            </FieldShell>

            <FieldShell id="next-action-note" label="Nota da próxima ação" error={fieldErrors.nextActionNote} className="sm:col-span-2">
              <Input
                id="next-action-note"
                value={nextActionNote}
                onChange={(e) => setNextActionNote(e.target.value)}
                maxLength={MAX_NOTE_LENGTH}
                placeholder="Opcional"
                aria-invalid={fieldErrors.nextActionNote ? true : undefined}
                aria-describedby={fieldDescribedBy("next-action-note", fieldErrors.nextActionNote)}
              />
            </FieldShell>
          </div>
        )}
      </div>

      <div aria-live="polite" className="empty:hidden">
        {error && <InlineError>{error}</InlineError>}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSaving ? "Registrando…" : "Registrar atividade"}
        </Button>
      </div>
    </form>
  )
}
