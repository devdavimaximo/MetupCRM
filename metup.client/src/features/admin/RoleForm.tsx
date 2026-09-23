import { type FormEvent, useRef, useState } from "react"
import { Loader2, Lock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { InlineError } from "@/components/ui/states"
import { Switch } from "@/components/ui/switch"
import { toFieldErrors, toMessage, type FieldErrors } from "@/features/companies/form-errors"
import type { Permission } from "@/lib/auth"
import { permissionGroups } from "@/lib/permissions"
import { createRole, updateRole, type Role } from "./api"

type Props = {
  /** null = cargo novo. */
  role: Role | null
  /** Permissões de quem está editando: o servidor recusa conceder o que o próprio cargo não tem. */
  grantable: Permission[]
  onSaved: (role: Role) => void
  onCancel: () => void
}

export function RoleForm({ role, grantable, onSaved, onCancel }: Props) {
  const [name, setName] = useState(role?.name ?? "")
  const [description, setDescription] = useState(role?.description ?? "")
  const [permissions, setPermissions] = useState<Set<Permission>>(() => new Set(role?.permissions ?? []))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const locked = role?.isAdministrator ?? false

  function toggle(permission: Permission, checked: boolean) {
    setPermissions((current) => {
      const next = new Set(current)
      if (checked) next.add(permission)
      else next.delete(permission)
      return next
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setFieldErrors({})

    try {
      const input = { name: name.trim(), description: description.trim() || null, permissions: [...permissions] }
      onSaved(role ? await updateRole(role.id, input) : await createRole(input))
    } catch (err) {
      const errors = toFieldErrors(err)
      setFieldErrors(errors)
      setError(Object.keys(errors).length ? null : toMessage(err, "Não foi possível salvar o cargo."))
      nameRef.current?.focus()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-5">
        <Field
          id="role-name"
          label="Nome do cargo"
          required
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          placeholder="Financeiro…"
          maxLength={80}
          error={fieldErrors.name}
        />
        <Field
          id="role-description"
          label="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          autoComplete="off"
          placeholder="Acompanha receita e relatórios…"
          maxLength={240}
          error={fieldErrors.description}
        />
      </div>

      {locked && (
        <p className="flex items-start gap-2 border-l-2 border-line-strong bg-surface-2 px-4 py-3 text-sm text-fg-muted">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          O Administrador sempre tem todas as permissões, inclusive as que surgirem depois. Só nome e descrição mudam.
        </p>
      )}

      {permissionGroups.map((group) => (
        <fieldset key={group.label} className="flex flex-col gap-1">
          <legend className="label-mono pb-1 text-fg-muted">{group.label}</legend>
          <p className="pb-2 text-sm text-muted">{group.description}</p>
          <ul className="flex flex-col divide-y divide-line-soft/70 rounded-sm border border-line-soft">
            {group.items.map((item) => {
              const id = `perm-${item.permission}`
              const cannotGrant = !grantable.includes(item.permission)
              return (
                <li key={item.permission} className="flex items-center justify-between gap-4 px-4 py-3">
                  <label htmlFor={id} className="flex min-w-0 cursor-pointer flex-col gap-0.5">
                    <span className="text-base font-medium text-fg">{item.label}</span>
                    <span id={`${id}-desc`} className="text-sm text-muted">
                      {item.description}
                      {cannotGrant && !locked && " Seu cargo não tem esta permissão, então você não pode concedê-la."}
                    </span>
                  </label>
                  <Switch
                    id={id}
                    aria-describedby={`${id}-desc`}
                    checked={locked || permissions.has(item.permission)}
                    disabled={locked || cannotGrant}
                    onCheckedChange={(checked) => toggle(item.permission, checked)}
                  />
                </li>
              )
            })}
          </ul>
        </fieldset>
      ))}

      {error && <InlineError>{error}</InlineError>}

      <div className="flex flex-wrap justify-end gap-2 border-t border-line-soft pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {role ? "Salvar cargo" : "Criar cargo"}
        </Button>
      </div>
    </form>
  )
}
