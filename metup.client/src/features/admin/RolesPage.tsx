import { useState } from "react"
import { Loader2, Lock, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Page, PageHeader } from "@/components/ui/page"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Alert, EmptyState, InlineError, SkeletonRows } from "@/components/ui/states"
import { Toaster } from "@/components/ui/toast"
import { toMessage } from "@/features/companies/form-errors"
import type { Permission } from "@/lib/auth"
import { pluralize } from "@/lib/format"
import { useAsyncResource } from "@/lib/hooks"
import { permissionGroups, permissionLabels } from "@/lib/permissions"
import { useToasts } from "@/lib/toasts"
import { deleteRole, listRoles, type Role } from "./api"
import { RoleForm } from "./RoleForm"

type Props = {
  /** Permissões de quem está logado — limitam o que dá para conceder. */
  grantable: Permission[]
}

type Editing = { mode: "create" } | { mode: "edit"; role: Role } | null

/** Cargos da organização: o que cada um libera. Mudanças valem na próxima ação de quem está no cargo. */
export function RolesPage({ grantable }: Props) {
  const roles = useAsyncResource((signal) => listRoles(signal), [])
  const toasts = useToasts()

  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<Role | null>(null)

  function replaceRole(saved: Role) {
    roles.setData((current) => {
      if (!current) return [saved]
      return current.some((r) => r.id === saved.id) ? current.map((r) => (r.id === saved.id ? saved : r)) : [...current, saved]
    })
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Administração"
        title="Cargos"
        description="Cada cargo define as telas que aparecem, se a pessoa opera só a própria carteira ou a equipe inteira, e quem administra o sistema."
        actions={
          <Button onClick={() => setEditing({ mode: "create" })} className="max-sm:w-full">
            <Plus aria-hidden="true" />
            Novo cargo
          </Button>
        }
      />

      {Boolean(roles.error) && <Alert onRetry={() => roles.reload()}>{toMessage(roles.error, "Não foi possível carregar os cargos.")}</Alert>}

      {roles.isLoading ? (
        <Card className="p-0">
          <SkeletonRows rows={3} label="Carregando cargos…" />
        </Card>
      ) : roles.data && roles.data.length === 0 ? (
        <Card>
          <EmptyState icon={ShieldCheck} title="Nenhum cargo" description="Crie um cargo e escolha o que ele libera." />
        </Card>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {roles.data?.map((role) => (
            <li key={role.id}>
              <RoleCard
                role={role}
                onEdit={() => setEditing({ mode: "edit", role })}
                onDelete={() => setDeleting(role)}
              />
            </li>
          ))}
        </ul>
      )}

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent size="lg">
          <SheetHeader>
            <SheetTitle>{editing?.mode === "edit" ? `Editar ${editing.role.name}` : "Novo cargo"}</SheetTitle>
            <SheetDescription>Marque o que este cargo pode acessar.</SheetDescription>
          </SheetHeader>
          <SheetBody className="px-5 py-5 sm:px-6">
            {editing && (
              <RoleForm
                key={editing.mode === "edit" ? editing.role.id : "new"}
                role={editing.mode === "edit" ? editing.role : null}
                grantable={grantable}
                onCancel={() => setEditing(null)}
                onSaved={(saved) => {
                  replaceRole(saved)
                  setEditing(null)
                  toasts.show({ message: editing.mode === "edit" ? "Cargo atualizado." : `Cargo ${saved.name} criado.` })
                }}
              />
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>

      <DeleteRoleDialog
        role={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(role) => {
          roles.setData((current) => current?.filter((r) => r.id !== role.id) ?? null)
          toasts.show({ message: `Cargo ${role.name} excluído.` })
        }}
      />

      <Toaster toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </Page>
  )
}

function RoleCard({ role, onEdit, onDelete }: { role: Role; onEdit: () => void; onDelete: () => void }) {
  const granted = new Set(role.permissions)

  return (
    <Card className="h-full gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-fg">
            {role.name}
            {role.isAdministrator && <Lock className="size-3.5 text-muted" aria-label="Cargo do sistema" />}
          </h2>
          {role.description && <p className="text-sm text-fg-muted">{role.description}</p>}
          <p className="label-mono text-faint">{pluralize(role.userCount, "usuário", "usuários")}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Editar ${role.name}`} title="Editar">
            <Pencil aria-hidden="true" />
          </Button>
          {!role.isAdministrator && (
            <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label={`Excluir ${role.name}`} title="Excluir">
              <Trash2 aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      <dl className="flex flex-col gap-3 border-t border-line-soft pt-4">
        {permissionGroups.map((group) => {
          const items = group.items.filter((item) => granted.has(item.permission))
          return (
            <div key={group.label} className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-start gap-3">
              <dt className="label-mono pt-0.5 text-muted">{group.label}</dt>
              <dd className="flex flex-wrap gap-1.5">
                {items.length === 0 ? (
                  <span className="text-sm text-faint">
                    {group.items.length === 1 ? "Só a própria carteira" : "Nenhuma"}
                  </span>
                ) : (
                  items.map((item) => (
                    <Badge key={item.permission} variant={group.label === "Administração" ? "accent" : "default"}>
                      {permissionLabels[item.permission]}
                    </Badge>
                  ))
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </Card>
  )
}

function DeleteRoleDialog({ role, onClose, onDeleted }: { role: Role | null; onClose: () => void; onDeleted: (role: Role) => void }) {
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const hasUsers = (role?.userCount ?? 0) > 0

  async function confirm() {
    if (!role) return
    setIsDeleting(true)
    setError(null)
    try {
      await deleteRole(role.id)
      onDeleted(role)
      onClose()
    } catch (err) {
      setError(toMessage(err, "Não foi possível excluir o cargo."))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog
      open={role !== null}
      onOpenChange={(open) => {
        if (!open) {
          setError(null)
          onClose()
        }
      }}
    >
      <DialogContent role="alertdialog">
        <DialogHeader>
          <DialogTitle>{hasUsers ? `${role?.name} tem usuários` : `Excluir ${role?.name}?`}</DialogTitle>
          <DialogDescription>
            {hasUsers
              ? `Mova os ${pluralize(role?.userCount ?? 0, "usuário", "usuários")} deste cargo para outro na tela de Usuários antes de excluir.`
              : "O cargo some da lista de cargos. Isso não pode ser desfeito."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-5 py-5">
          {error && <InlineError>{error}</InlineError>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {hasUsers ? "Entendi" : "Cancelar"}
            </Button>
            {!hasUsers && (
              <Button type="button" variant="destructive" onClick={confirm} disabled={isDeleting}>
                {isDeleting && <Loader2 className="animate-spin" aria-hidden="true" />}
                Excluir cargo
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
