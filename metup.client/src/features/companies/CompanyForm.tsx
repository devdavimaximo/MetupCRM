import { type FormEvent, useRef, useState } from "react"
import { Check, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { InlineError } from "@/components/ui/states"
import { createCompany, updateCompany, type Company, type CompanyInput } from "./api"
import { toFieldErrors, toMessage, type FieldErrors } from "./form-errors"

/**
 * O formulário guarda o que foi digitado. Quem troca de empresa remonta o
 * componente por `key` (ver CompanySheet) em vez de ressincronizar por efeito.
 */
type Props = {
  /** null = cadastrando uma empresa nova. */
  company: Company | null
  onSaved: (company: Company) => void
  onCancel?: () => void
}

type FormState = {
  name: string
  segment: string
  city: string
  instagram: string
  phone: string
}

const emptyForm: FormState = { name: "", segment: "", city: "", instagram: "", phone: "" }

function toFormState(company: Company | null): FormState {
  if (!company) return emptyForm
  return {
    name: company.name,
    segment: company.segment ?? "",
    city: company.city ?? "",
    instagram: company.instagram ?? "",
    phone: company.phone ?? "",
  }
}

function toInput(form: FormState): CompanyInput {
  const optional = (value: string) => (value.trim() ? value.trim() : null)
  return {
    name: form.name.trim(),
    segment: optional(form.segment),
    city: optional(form.city),
    instagram: optional(form.instagram),
    phone: optional(form.phone),
  }
}

export function CompanyForm({ company, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<FormState>(() => toFormState(company))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

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
      const saved = company ? await updateCompany(company.id, input) : await createCompany(input)
      setSavedAt(Date.now())
      onSaved(saved)
    } catch (err) {
      const errors = toFieldErrors(err)
      setFieldErrors(errors)
      setError(Object.keys(errors).length ? null : toMessage(err, "Não foi possível salvar a empresa."))
      nameRef.current?.focus()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        <Field
          id="company-name"
          label="Nome da empresa"
          className="sm:col-span-2"
          required
          ref={nameRef}
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          autoComplete="organization"
          placeholder="Padaria do Bairro…"
          error={fieldErrors.name}
        />

        <Field
          id="company-segment"
          label="Segmento"
          value={form.segment}
          onChange={(e) => update("segment", e.target.value)}
          autoComplete="off"
          placeholder="Alimentação…"
          error={fieldErrors.segment}
        />

        <Field
          id="company-city"
          label="Cidade"
          value={form.city}
          onChange={(e) => update("city", e.target.value)}
          autoComplete="address-level2"
          placeholder="Porto Alegre…"
          error={fieldErrors.city}
        />

        <Field
          id="company-phone"
          label="Telefone"
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="(51) 99999-0000…"
          error={fieldErrors.phone}
        />

        <Field
          id="company-instagram"
          label="Instagram"
          value={form.instagram}
          onChange={(e) => update("instagram", e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="@padariadobairro…"
          error={fieldErrors.instagram}
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        <div aria-live="polite" className="mr-auto min-h-5">
          {error && <InlineError>{error}</InlineError>}
          {!error && savedAt && (
            <p className="flex items-center gap-1.5 text-sm text-success">
              <Check className="size-3.5" aria-hidden="true" />
              Empresa salva.
            </p>
          )}
        </div>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant={company ? "outline" : "default"} disabled={isSaving}>
          {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSaving ? "Salvando…" : company ? "Salvar alterações" : "Cadastrar empresa"}
        </Button>
      </div>
    </form>
  )
}
