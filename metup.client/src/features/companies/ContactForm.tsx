import { type FormEvent, useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { InlineError } from "@/components/ui/states"
import { createContact, updateContact, type Contact, type ContactInput } from "./api"
import { toFieldErrors, toMessage, type FieldErrors } from "./form-errors"

type Props = {
  companyId: string
  /** null = adicionando um contato novo à empresa. */
  contact: Contact | null
  onSaved: (contact: Contact) => void
  onCancel: () => void
}

type FormState = {
  name: string
  role: string
  phone: string
  whatsApp: string
  email: string
}

function toFormState(contact: Contact | null): FormState {
  return {
    name: contact?.name ?? "",
    role: contact?.role ?? "",
    phone: contact?.phone ?? "",
    whatsApp: contact?.whatsApp ?? "",
    email: contact?.email ?? "",
  }
}

function toInput(form: FormState): ContactInput {
  const optional = (value: string) => (value.trim() ? value.trim() : null)
  return {
    name: form.name.trim(),
    role: optional(form.role),
    phone: optional(form.phone),
    whatsApp: optional(form.whatsApp),
    email: optional(form.email),
  }
}

export function ContactForm({ companyId, contact, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<FormState>(() => toFormState(contact))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const prefix = contact ? `contact-${contact.id}` : "contact-new"

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setFieldErrors({})

    try {
      const input = toInput(form)
      const saved = contact ? await updateContact(contact.id, input) : await createContact(companyId, input)
      onSaved(saved)
    } catch (err) {
      const errors = toFieldErrors(err)
      setFieldErrors(errors)
      setError(Object.keys(errors).length ? null : toMessage(err, "Não foi possível salvar o contato."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-sm border border-line-strong/50 bg-surface-2/40 p-4"
      noValidate
      aria-label={contact ? `Editar ${contact.name}` : "Novo contato"}
    >
      <p className="label-mono text-fg-muted">{contact ? "Editar contato" : "Novo contato"}</p>

      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        <Field
          id={`${prefix}-name`}
          label="Nome"
          required
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          autoComplete="off"
          placeholder="Maria Souza…"
          error={fieldErrors.name}
          autoFocus
        />

        <Field
          id={`${prefix}-role`}
          label="Cargo"
          value={form.role}
          onChange={(e) => update("role", e.target.value)}
          autoComplete="off"
          placeholder="Sócia-proprietária…"
          error={fieldErrors.role}
        />

        <Field
          id={`${prefix}-phone`}
          label="Telefone"
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="(51) 3333-0000…"
          error={fieldErrors.phone}
        />

        <Field
          id={`${prefix}-whatsapp`}
          label="WhatsApp"
          type="tel"
          inputMode="tel"
          value={form.whatsApp}
          onChange={(e) => update("whatsApp", e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="(51) 99999-0000…"
          error={fieldErrors.whatsApp}
        />

        <Field
          id={`${prefix}-email`}
          label="E-mail"
          type="email"
          inputMode="email"
          className="sm:col-span-2"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="maria@empresa.com.br…"
          error={fieldErrors.email}
        />
      </div>

      <div aria-live="polite" className="empty:hidden">
        {error && <InlineError>{error}</InlineError>}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSaving ? "Salvando…" : contact ? "Salvar contato" : "Adicionar contato"}
        </Button>
      </div>
    </form>
  )
}
