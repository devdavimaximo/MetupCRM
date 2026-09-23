import { type FormEvent, useRef, useState } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, SelectField } from "@/components/ui/field"
import { InlineError } from "@/components/ui/states"
import { toFieldErrors, toMessage, type FieldErrors } from "@/features/companies/form-errors"
import { createUser, updateUser, type ManagedUser, type Role } from "./api"

export const PASSWORD_MIN_LENGTH = 8

type Props = {
  /** null = cadastrando um usuário novo (aí a senha é pedida aqui). */
  user: ManagedUser | null
  roles: Role[]
  onSaved: (user: ManagedUser) => void
  onCancel: () => void
}

export function UserForm({ user, roles, onSaved, onCancel }: Props) {
  const [name, setName] = useState(user?.name ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const [password, setPassword] = useState("")
  const [roleId, setRoleId] = useState(user?.roleId ?? roles.find((r) => !r.isAdministrator)?.id ?? roles[0]?.id ?? "")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const selectedRole = roles.find((r) => r.id === roleId)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setFieldErrors({})

    try {
      const input = { name: name.trim(), email: email.trim(), roleId }
      const saved = user ? await updateUser(user.id, input) : await createUser({ ...input, password })
      onSaved(saved)
    } catch (err) {
      const errors = toFieldErrors(err)
      setFieldErrors(errors)
      setError(Object.keys(errors).length ? null : toMessage(err, "Não foi possível salvar o usuário."))
      nameRef.current?.focus()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <Field
        id="user-name"
        label="Nome"
        required
        ref={nameRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="off"
        placeholder="Ana Souza…"
        error={fieldErrors.name}
      />

      <Field
        id="user-email"
        label="E-mail"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        placeholder="ana@empresa.com.br…"
        hint="É com ele que a pessoa entra no sistema."
        error={fieldErrors.email}
      />

      {!user && (
        <PasswordField
          id="user-password"
          label="Senha inicial"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
        />
      )}

      <SelectField
        id="user-role"
        label="Cargo"
        required
        value={roleId}
        onChange={(e) => setRoleId(e.target.value)}
        hint={selectedRole?.description ?? undefined}
        error={fieldErrors.roleId}
      >
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </SelectField>

      {error && <InlineError>{error}</InlineError>}

      <div className="flex flex-wrap justify-end gap-2 border-t border-line-soft pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {user ? "Salvar alterações" : "Criar usuário"}
        </Button>
      </div>
    </form>
  )
}

/** Senha com mostrar/ocultar — quem cadastra costuma repassar a senha e precisa conferir o que digitou. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoFocus,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  autoFocus?: boolean
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Field
        id={id}
        label={label}
        type={visible ? "text" : "password"}
        required
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="new-password"
        spellCheck={false}
        className="[&_input]:pr-11"
        hint={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres.`}
        error={error}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-controls={id}
        aria-pressed={visible}
        className="absolute top-[1.625rem] right-1 inline-flex size-9 cursor-pointer items-center justify-center rounded-xs text-muted transition-colors hover:text-fg focus-visible:focus-ring"
      >
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  )
}
