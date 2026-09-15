import { type FormEvent, useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, SelectField } from "@/components/ui/field"
import { InlineError } from "@/components/ui/states"
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
      const saved = deal ? await updateDeal(deal.id, input) : await createDeal({ ...input, companyId })
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
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

        <SelectField
          id="deal-source"
          label="Origem"
          required
          value={form.source}
          onChange={(e) => update("source", e.target.value as DealSource)}
          error={fieldErrors.source}
          className="sm:col-span-2"
        >
          {Object.entries(sourceLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>

        <Field
          id="deal-ticket"
          label="Ticket estimado"
          inputMode="decimal"
          value={form.ticket}
          onChange={(e) => update("ticket", e.target.value)}
          placeholder="0,00"
          hint={form.ticket ? formatMoney(parseMoney(form.ticket)) : "Valor estimado ao entrar no funil."}
          error={fieldErrors.ticket}
        />

        <Field
          id="deal-amount"
          label="Valor em negociação"
          inputMode="decimal"
          value={form.amount}
          onChange={(e) => update("amount", e.target.value)}
          placeholder="0,00"
          hint={form.amount ? formatMoney(parseMoney(form.amount)) : "Vira o valor fechado quando o negócio for ganho."}
          error={fieldErrors.amount}
        />
      </div>

      <div aria-live="polite" className="empty:hidden">
        {error && <InlineError>{error}</InlineError>}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant={deal ? "outline" : "default"} disabled={isSaving}>
          {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSaving ? "Salvando…" : deal ? "Salvar alterações" : "Cadastrar negócio"}
        </Button>
      </div>
    </form>
  )
}
