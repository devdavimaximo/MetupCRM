import { type FormEvent, useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SelectField } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toFieldErrors, toMessage } from "@/features/companies/form-errors"
import { formatMoney, parseMoney } from "@/lib/money"
import { createDeal, updateDeal, type Deal, type DealInput, type DealSource, type UserSummary } from "./api"
import { sourceLabels } from "./stage-labels"

type Props = {
  companyId: string
  contacts: { id: string; name: string }[]
  users: UserSummary[]
  /** null = cadastrando um negócio novo para a empresa. */
  deal: Deal | null
  onSaved: (deal: Deal) => void
  onCancel?: () => void
}

type FormState = {
  contactId: string
  source: DealSource
  ownerUserId: string
  ticket: string
  amount: string
}

function toFormState(deal: Deal | null): FormState {
  return {
    contactId: deal?.contactId ?? "",
    source: deal?.source ?? "Sdr",
    ownerUserId: deal?.ownerUserId ?? "",
    ticket: deal?.ticket != null ? String(deal.ticket) : "",
    amount: deal?.amount != null ? String(deal.amount) : "",
  }
}

function toInput(form: FormState): DealInput {
  return {
    contactId: form.contactId || null,
    source: form.source,
    ownerUserId: form.ownerUserId,
    ticket: parseMoney(form.ticket),
    amount: parseMoney(form.amount),
  }
}

export function DealForm({ companyId, contacts, users, deal, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<FormState>(() => toFormState(deal))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setFieldErrors({})

    try {
      const input = toInput(form)
      const saved = deal
        ? await updateDeal(deal.id, input)
        : await createDeal({ ...input, companyId })
      onSaved(saved)
    } catch (err) {
      const errors = toFieldErrors(err)
      setFieldErrors(errors)
      setError(Object.keys(errors).length ? null : toMessage(err, "Não foi possível salvar o negócio."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="deal-contact"
          label="Contato"
          value={form.contactId}
          onChange={(e) => update("contactId", e.target.value)}
          error={fieldErrors.contactId}
        >
          <option value="">Sem contato definido</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="deal-source"
          label="Origem"
          required
          value={form.source}
          onChange={(e) => update("source", e.target.value as DealSource)}
          error={fieldErrors.source}
        >
          {Object.entries(sourceLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="deal-owner"
          label="Responsável"
          required
          value={form.ownerUserId}
          onChange={(e) => update("ownerUserId", e.target.value)}
          error={fieldErrors.ownerUserId}
        >
          <option value="" disabled>
            Selecione…
          </option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </SelectField>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="deal-ticket">Ticket estimado</Label>
          <Input
            id="deal-ticket"
            inputMode="decimal"
            value={form.ticket}
            onChange={(e) => update("ticket", e.target.value)}
            placeholder="0,00"
            aria-describedby="deal-ticket-hint"
          />
          <p id="deal-ticket-hint" className="text-xs text-muted-foreground">
            {form.ticket ? formatMoney(parseMoney(form.ticket)) : "Valor estimado ao entrar no funil."}
          </p>
          {fieldErrors.ticket && <p className="text-xs font-medium text-destructive">{fieldErrors.ticket}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="deal-amount">Valor em negociação</Label>
          <Input
            id="deal-amount"
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => update("amount", e.target.value)}
            placeholder="0,00"
            aria-describedby="deal-amount-hint"
          />
          <p id="deal-amount-hint" className="text-xs text-muted-foreground">
            {form.amount ? formatMoney(parseMoney(form.amount)) : "Vira o valor fechado quando o negócio for ganho."}
          </p>
          {fieldErrors.amount && <p className="text-xs font-medium text-destructive">{fieldErrors.amount}</p>}
        </div>
      </div>

      <div aria-live="polite" className="empty:hidden min-h-5">
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSaving ? "Salvando…" : deal ? "Salvar Negócio" : "Cadastrar Negócio"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}
