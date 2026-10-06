import { type FormEvent, useState } from "react"
import { Loader2, Pencil, Phone, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, SelectField } from "@/components/ui/field"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Alert, EmptyState, InlineError, SkeletonRows } from "@/components/ui/states"
import { toFieldErrors, toMessage } from "@/features/companies/form-errors"
import { listUsers } from "@/features/deals/api"
import { useAsyncResource } from "@/lib/hooks"
import { createPhoneLine, listPhoneLines, setPhoneLineActive, updatePhoneLine, type PhoneLine } from "./api"

type Draft = { id: string | null; userId: string; label: string; number: string; isDefault: boolean }

const emptyDraft = (userId = ""): Draft => ({ id: null, userId, label: "Celular", number: "", isDefault: false })

/**
 * Administração das linhas (permissão "Linhas telefônicas"): cada usuário com o seu número. Um
 * número ativo fica com uma pessoa só — o servidor recusa o repetido dizendo com quem ele está.
 * Linha não se exclui, desativa: as ligações feitas por ela continuam apontando para ela.
 */
export function PhoneLinesSheet({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Avisa a tela do discador para reler as linhas do próprio usuário. */
  onChanged: () => void
}) {
  const lines = useAsyncResource((signal) => listPhoneLines(signal), [], { enabled: open, keepPreviousData: true })
  const users = useAsyncResource((signal) => listUsers(signal), [], { enabled: open })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function startDraft(next: Draft) {
    setDraft(next)
    setFieldErrors({})
    setError(null)
  }

  function afterChange() {
    lines.reload({ silent: true })
    onChanged()
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    setSaving(true)
    setFieldErrors({})
    setError(null)
    try {
      if (draft.id) {
        await updatePhoneLine(draft.id, { label: draft.label, number: draft.number, makeDefault: draft.isDefault })
      } else {
        await createPhoneLine({ userId: draft.userId, kind: "Device", label: draft.label, number: draft.number, isDefault: draft.isDefault })
      }
      setDraft(null)
      afterChange()
    } catch (err) {
      const errors = toFieldErrors(err)
      setFieldErrors(errors)
      setError(Object.keys(errors).length ? null : toMessage(err, "Não foi possível salvar a linha."))
    } finally {
      setSaving(false)
    }
  }

  async function runRowAction(line: PhoneLine, action: () => Promise<unknown>) {
    setBusyId(line.id)
    setError(null)
    try {
      await action()
      afterChange()
    } catch (err) {
      setError(toMessage(err, "Não foi possível alterar a linha."))
    } finally {
      setBusyId(null)
    }
  }

  const byUser = groupByUser(lines.data ?? [])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Linhas telefônicas</SheetTitle>
          <SheetDescription>
            Cada pessoa liga do próprio número. A ligação registrada guarda a linha usada, e um número ativo não pode estar com duas pessoas.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="gap-6 px-5 py-5 sm:px-6">
          {draft ? (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 rounded-sm border border-line-soft p-4">
              <p className="text-sm font-medium text-fg">{draft.id ? "Editar linha" : "Nova linha"}</p>
              {!draft.id && (
                <SelectField
                  id="line-user"
                  label="Usuário"
                  required
                  value={draft.userId}
                  onChange={(e) => setDraft({ ...draft, userId: e.target.value })}
                  error={fieldErrors.userId}
                >
                  <option value="">Escolha quem vai usar</option>
                  {(users.data ?? []).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </SelectField>
              )}
              <Field
                id="line-label"
                label="Nome da linha"
                required
                value={draft.label}
                autoComplete="off"
                maxLength={60}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                error={fieldErrors.label}
              />
              <Field
                id="line-number"
                label="Número"
                required
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="(11) 91234-5678"
                value={draft.number}
                maxLength={30}
                onChange={(e) => setDraft({ ...draft, number: e.target.value })}
                error={fieldErrors.number}
                hint="Com DDD. É o número de onde a pessoa liga (o chip do celular dela)."
              />
              <label className="flex cursor-pointer items-center gap-3 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={draft.isDefault}
                  onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
                  className="size-4 accent-accent"
                />
                Linha principal (o discador usa esta por padrão)
              </label>
              <div aria-live="polite" className="empty:hidden">
                {error && <InlineError>{error}</InlineError>}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving || (!draft.id && !draft.userId)}>
                  {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {draft.id ? "Salvar" : "Cadastrar linha"}
                </Button>
              </div>
            </form>
          ) : (
            <Button type="button" variant="outline" onClick={() => startDraft(emptyDraft())} className="self-start">
              <Plus aria-hidden="true" />
              Nova linha
            </Button>
          )}

          {!draft && error && <Alert>{error}</Alert>}

          {lines.isLoading && !lines.data ? (
            <SkeletonRows rows={3} />
          ) : lines.error && !lines.data ? (
            <Alert onRetry={() => lines.reload()}>{toMessage(lines.error, "Não foi possível carregar as linhas.")}</Alert>
          ) : byUser.length === 0 ? (
            <EmptyState compact icon={Phone} title="Nenhuma linha ainda" description="Cadastre o número de cada pessoa que vai usar o discador." />
          ) : (
            <div className="flex flex-col gap-5">
              {byUser.map(({ userId, userName, lines: userLines }) => (
                <section key={userId} aria-label={`Linhas de ${userName}`} className="flex flex-col gap-1.5">
                  <h3 className="label-mono text-muted">{userName}</h3>
                  <ul className="flex flex-col divide-y divide-line-soft rounded-sm border border-line-soft">
                    {userLines.map((line) => (
                      <li key={line.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className={line.isActive ? "text-sm text-fg" : "text-sm text-muted line-through"}>{line.label}</span>
                          <span className="font-mono text-xs text-fg-muted tabular">{line.number}</span>
                        </span>
                        {line.isDefault && <Badge variant="accent">Principal</Badge>}
                        {!line.isActive && <Badge variant="outline">Desativada</Badge>}
                        <span className="flex gap-1">
                          {line.isActive && !line.isDefault && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busyId === line.id}
                              onClick={() => runRowAction(line, () => updatePhoneLine(line.id, { label: line.label, number: line.number, makeDefault: true }))}
                            >
                              Tornar principal
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Editar ${line.label} de ${line.userName}`}
                            onClick={() => startDraft({ id: line.id, userId: line.userId, label: line.label, number: line.number, isDefault: line.isDefault })}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={line.isActive ? "ghost" : "outline"}
                            disabled={busyId === line.id}
                            onClick={() => runRowAction(line, () => setPhoneLineActive(line.id, !line.isActive))}
                          >
                            {busyId === line.id && <Loader2 className="animate-spin" aria-hidden="true" />}
                            {line.isActive ? "Desativar" : "Reativar"}
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

/** Agrupa pelo id (nomes podem repetir), na ordem em que o servidor já devolve. */
function groupByUser(lines: PhoneLine[]): { userId: string; userName: string; lines: PhoneLine[] }[] {
  const groups = new Map<string, { userId: string; userName: string; lines: PhoneLine[] }>()
  for (const line of lines) {
    const group = groups.get(line.userId) ?? { userId: line.userId, userName: line.userName, lines: [] }
    group.lines.push(line)
    groups.set(line.userId, group)
  }
  return [...groups.values()]
}
