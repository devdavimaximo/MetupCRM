import { type FormEvent, useState } from "react"
import { KeyRound, Loader2, MoreHorizontal, Pencil, Plus, UserCheck, UserX, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Monogram } from "@/components/ui/monogram"
import { Page, PageHeader } from "@/components/ui/page"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Alert, EmptyState, InlineError, SkeletonRows } from "@/components/ui/states"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Toaster } from "@/components/ui/toast"
import { toFieldErrors, toMessage } from "@/features/companies/form-errors"
import { formatShortDate, pluralize } from "@/lib/format"
import { useAsyncResource } from "@/lib/hooks"
import { useToasts } from "@/lib/toasts"
import { listManagedUsers, listRoles, resetUserPassword, setUserActive, type ManagedUser } from "./api"
import { PasswordField, UserForm } from "./UserForm"

type Props = {
  currentUserId: string
}

type Editing = { mode: "create" } | { mode: "edit"; user: ManagedUser } | null

/**
 * Administração de usuários: quem entra no sistema, com qual cargo. Não há exclusão — o usuário é
 * autor de histórico comercial; desativar tira o acesso na hora e preserva tudo.
 */
export function UsersPage({ currentUserId }: Props) {
  const users = useAsyncResource((signal) => listManagedUsers(signal), [])
  const roles = useAsyncResource((signal) => listRoles(signal), [])
  const toasts = useToasts()

  const [editing, setEditing] = useState<Editing>(null)
  const [resetting, setResetting] = useState<ManagedUser | null>(null)
  const [deactivating, setDeactivating] = useState<ManagedUser | null>(null)

  const activeCount = users.data?.filter((u) => u.isActive).length ?? 0

  function replaceUser(saved: ManagedUser) {
    users.setData((current) => {
      if (!current) return [saved]
      return current.some((u) => u.id === saved.id)
        ? current.map((u) => (u.id === saved.id ? saved : u))
        : [...current, saved].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name))
    })
  }

  async function reactivate(user: ManagedUser) {
    try {
      replaceUser(await setUserActive(user.id, true))
      toasts.show({ message: `${user.name} pode entrar de novo.` })
    } catch (err) {
      toasts.show({ message: toMessage(err, "Não foi possível reativar o usuário."), tone: "danger" })
    }
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Administração"
        title="Usuários"
        description={
          users.data
            ? `${pluralize(activeCount, "usuário ativo", "usuários ativos")} de ${users.data.length}. Cada um entra com e-mail e senha e vê o que o cargo libera.`
            : "Quem entra no sistema e com qual cargo."
        }
        actions={
          <Button onClick={() => setEditing({ mode: "create" })} disabled={!roles.data} className="max-sm:w-full">
            <Plus aria-hidden="true" />
            Novo usuário
          </Button>
        }
      />

      {Boolean(users.error || roles.error) && (
        <Alert
          onRetry={() => {
            users.reload()
            roles.reload()
          }}
        >
          {toMessage(users.error ?? roles.error, "Não foi possível carregar os usuários.")}
        </Alert>
      )}

      <Card className="overflow-hidden p-0">
        {users.isLoading ? (
          <SkeletonRows rows={4} label="Carregando usuários…" />
        ) : users.data && users.data.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum usuário ainda"
            description="Crie o primeiro usuário com e-mail, senha inicial e cargo."
          />
        ) : users.data ? (
          <Table minWidth="44rem">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Usuário</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead>
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.map((user) => (
                <TableRow key={user.id} className={user.isActive ? undefined : "opacity-60"}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <Monogram name={user.name} size="sm" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-fg">
                          {user.name}
                          {user.id === currentUserId && <span className="ml-2 text-sm font-normal text-muted">(você)</span>}
                        </span>
                        <span className="truncate text-sm text-muted">{user.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{user.roleName}</TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "success" : "outline"} dot>
                      {user.isActive ? "Ativo" : "Desativado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular">{formatShortDate(user.createdAt)}</TableCell>
                  <TableCell className="w-12 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${user.name}`}>
                          <MoreHorizontal aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing({ mode: "edit", user })}>
                          <Pencil aria-hidden="true" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setResetting(user)}>
                          <KeyRound aria-hidden="true" />
                          Redefinir senha
                        </DropdownMenuItem>
                        {user.id !== currentUserId && (
                          <>
                            <DropdownMenuSeparator />
                            {user.isActive ? (
                              <DropdownMenuItem onSelect={() => setDeactivating(user)} className="text-danger">
                                <UserX aria-hidden="true" />
                                Desativar
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onSelect={() => reactivate(user)}>
                                <UserCheck aria-hidden="true" />
                                Reativar
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </Card>

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent size="md">
          <SheetHeader>
            <SheetTitle>{editing?.mode === "edit" ? "Editar usuário" : "Novo usuário"}</SheetTitle>
            <SheetDescription>
              {editing?.mode === "edit"
                ? "Mudanças de cargo valem na próxima ação da pessoa, sem novo login."
                : "Passe o e-mail e a senha inicial para a pessoa entrar."}
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="px-5 py-5 sm:px-6">
            {editing && roles.data && (
              <UserForm
                key={editing.mode === "edit" ? editing.user.id : "new"}
                user={editing.mode === "edit" ? editing.user : null}
                roles={roles.data}
                onCancel={() => setEditing(null)}
                onSaved={(saved) => {
                  replaceUser(saved)
                  setEditing(null)
                  roles.reload({ silent: true })
                  toasts.show({ message: editing.mode === "edit" ? "Usuário atualizado." : `${saved.name} foi criado.` })
                }}
              />
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>

      <ResetPasswordDialog
        user={resetting}
        onClose={() => setResetting(null)}
        onDone={(user) => toasts.show({ message: `Senha de ${user.name} redefinida.` })}
      />

      <DeactivateDialog
        user={deactivating}
        onClose={() => setDeactivating(null)}
        onDone={(saved) => {
          replaceUser(saved)
          toasts.show({ message: `${saved.name} foi desativado.` })
        }}
      />

      <Toaster toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </Page>
  )
}

function ResetPasswordDialog({
  user,
  onClose,
  onDone,
}: {
  user: ManagedUser | null
  onClose: () => void
  onDone: (user: ManagedUser) => void
}) {
  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {user && <ResetPasswordForm key={user.id} user={user} onClose={onClose} onDone={onDone} />}
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordForm({ user, onClose, onDone }: { user: ManagedUser; onClose: () => void; onDone: (user: ManagedUser) => void }) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | undefined>()
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(undefined)
    try {
      await resetUserPassword(user.id, password)
      onDone(user)
      onClose()
    } catch (err) {
      setError(toFieldErrors(err).password ?? toMessage(err, "Não foi possível redefinir a senha."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>Redefinir senha</DialogTitle>
        <DialogDescription>
          Nova senha para {user.name}. A senha atual deixa de funcionar assim que você salvar.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-5 px-5 py-5">
        <PasswordField id="reset-password" label="Nova senha" value={password} onChange={setPassword} error={error} autoFocus />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
            Salvar senha
          </Button>
        </div>
      </div>
    </form>
  )
}

function DeactivateDialog({
  user,
  onClose,
  onDone,
}: {
  user: ManagedUser | null
  onClose: () => void
  onDone: (user: ManagedUser) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function confirm() {
    if (!user) return
    setIsSaving(true)
    setError(null)
    try {
      onDone(await setUserActive(user.id, false))
      onClose()
    } catch (err) {
      setError(toMessage(err, "Não foi possível desativar o usuário."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open) {
          setError(null)
          onClose()
        }
      }}
    >
      <DialogContent role="alertdialog">
        <DialogHeader>
          <DialogTitle>Desativar {user?.name}?</DialogTitle>
          <DialogDescription>
            A pessoa sai do sistema na hora e não consegue entrar de novo. Negócios, tarefas e histórico dela continuam
            onde estão — dá para reativar depois.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-5 py-5">
          {error && <InlineError>{error}</InlineError>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={confirm} disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
              Desativar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
