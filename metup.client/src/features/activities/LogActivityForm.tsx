import { type FormEvent, useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SelectField } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toFieldErrors, toMessage } from "@/features/companies/form-errors"
import { logActivity, type ActivityOutcome, type ActivityType, type LogActivityResult } from "./api"
import { ALL_OUTCOMES, NEXT_ACTION_TYPES, activityOutcomeLabels, activityTypeLabels } from "./activity-labels"

const MAX_NOTE_LENGTH = 500

type Props = {
  dealId: string
  contacts: { id: string; name: string }[]
  onLogged: (result: LogActivityResult) => void
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

/**
 * Formulário de "registrar é rápido" (seção 3 do CLAUDE.md): tipo + desfecho estruturado + nota
 * curta, com a próxima ação escondida atrás de um toggle — só aparece quando o SDR pede.
 */
export function LogActivityForm({ dealId, contacts, onLogged }: Props) {
  const [type, setType] = useState<ActivityType>("Call")
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="activity-type"
          label="Tipo"
          required
          value={type}
          onChange={(e) => {
            const next = e.target.value as ActivityType
            setType(next)
            if (next !== "Call") setOutcome("")
          }}
          error={fieldErrors.type}
        >
          {Object.entries(activityTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>

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

        {needsOutcome && (
          <SelectField
            id="activity-outcome"
            label="Desfecho"
            required
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as ActivityOutcome)}
            error={fieldErrors.outcome}
            className="sm:col-span-2"
          >
            <option value="" disabled>
              Selecione…
            </option>
            {ALL_OUTCOMES.map((value) => (
              <option key={value} value={value}>
                {activityOutcomeLabels[value]}
              </option>
            ))}
          </SelectField>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity-note">Nota</Label>
        <Textarea
          id="activity-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          rows={2}
          placeholder="Uma linha curta — sem textão."
          aria-describedby="activity-note-hint"
        />
        <p id="activity-note-hint" className="text-xs text-muted-foreground">
          {note.length}/{MAX_NOTE_LENGTH}
        </p>
        {fieldErrors.note && <p className="text-xs font-medium text-destructive">{fieldErrors.note}</p>}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={scheduleNext}
            onChange={(e) => setScheduleNext(e.target.checked)}
            className="size-4 rounded border-border"
          />
          Já deixar a próxima ação agendada
        </label>

        {scheduleNext && (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              id="next-action-type"
              label="Tipo da próxima ação"
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="next-action-due-date">
                Quando <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Input
                id="next-action-due-date"
                type="datetime-local"
                required={scheduleNext}
                value={nextActionDueDate}
                onChange={(e) => setNextActionDueDate(e.target.value)}
                aria-invalid={fieldErrors.nextActionDueDate ? true : undefined}
              />
              {fieldErrors.nextActionDueDate && (
                <p className="text-xs font-medium text-destructive">{fieldErrors.nextActionDueDate}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="next-action-note">Nota da próxima ação</Label>
              <Input
                id="next-action-note"
                value={nextActionNote}
                onChange={(e) => setNextActionNote(e.target.value)}
                maxLength={MAX_NOTE_LENGTH}
                placeholder="Opcional"
              />
              {fieldErrors.nextActionNote && (
                <p className="text-xs font-medium text-destructive">{fieldErrors.nextActionNote}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div aria-live="polite" className="empty:hidden min-h-5">
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>

      <div>
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSaving ? "Registrando…" : "Registrar Atividade"}
        </Button>
      </div>
    </form>
  )
}
