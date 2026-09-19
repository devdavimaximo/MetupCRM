import { useState } from "react"
import { Ban, CalendarClock, Check, Loader2, UserRoundCog, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toMessage } from "@/features/companies/form-errors"
import type { UserSummary } from "@/features/deals/api"
import { numberFormatter } from "@/lib/format"
import { bulkTasks, type BulkTaskAction, type BulkTaskResult } from "./api"
import { OwnerListbox } from "./OwnerPicker"
import { focusOwnerListbox } from "./owner-listbox"
import { RescheduleForm } from "./RescheduleForm"

type Panel = "reschedule" | "reassign" | "cancel"

/**
 * Barra que aparece com tarefas selecionadas (só da página atual): Concluir · Reagendar ·
 * Reatribuir (Admin/Closer) · Cancelar (com confirmação e contagem) · Limpar seleção. Fica colada no
 * rodapé da lista, acima da paginação, sem cobri-la.
 */
export function TaskBulkBar({
  ids,
  canReassign,
  users,
  onDone,
  onClear,
}: {
  ids: string[]
  canReassign: boolean
  users: UserSummary[]
  onDone: (action: BulkTaskAction, result: BulkTaskResult) => void
  onClear: () => void
}) {
  const [panel, setPanel] = useState<Panel | null>(null)
  const [busy, setBusy] = useState<BulkTaskAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const count = ids.length
  const countText = `${numberFormatter.format(count)} ${count === 1 ? "selecionada" : "selecionadas"}`

  async function run(action: BulkTaskAction, extra: { dueDate?: string; ownerUserId?: string } = {}) {
    setBusy(action)
    setError(null)
    try {
      const result = await bulkTasks({ ids, action, ...extra })
      setPanel(null)
      onDone(action, result)
    } catch (err) {
      setError(toMessage(err, "Não foi possível alterar as tarefas selecionadas."))
    } finally {
      setBusy(null)
    }
  }

  const disabled = busy !== null

  function panelButton(kind: Panel, label: string, icon: React.ReactNode, destructive = false) {
    return (
      <Popover open={panel === kind} onOpenChange={(open) => setPanel(open ? kind : null)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            className={destructive ? "hover:border-danger hover:bg-danger/10 hover:text-danger" : undefined}
          >
            {busy !== null && panelAction[kind] === busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : icon}
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          role="dialog"
          aria-label={`${label}: ${countText}`}
          side="top"
          align="start"
          className={kind === "reassign" ? "flex w-72 flex-col p-0" : "w-72 p-3"}
          onOpenAutoFocus={kind === "reassign" ? (event) => focusOwnerListbox(event, users.length) : undefined}
        >
          {kind === "reschedule" && (
            <RescheduleForm initial={null} busy={disabled} onSubmit={(date) => run("Reschedule", { dueDate: date.toISOString() })} />
          )}
          {kind === "reassign" && (
            <>
              <p className="border-b border-line-soft px-3 py-2.5 text-sm font-medium text-fg">Reatribuir {countText} para</p>
              <OwnerListbox
                users={users}
                selectedKey={null}
                label="Novo responsável"
                onChoose={(ownerUserId) => void run("Reassign", { ownerUserId })}
              />
            </>
          )}
          {kind === "cancel" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-fg">
                Cancelar {count === 1 ? "a tarefa selecionada" : `as ${numberFormatter.format(count)} tarefas selecionadas`}? Elas saem da
                fila e ficam no histórico como canceladas.
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setPanel(null)}>
                  Voltar
                </Button>
                <Button type="button" size="sm" variant="destructive" disabled={disabled} onClick={() => run("Cancel")}>
                  {busy === "Cancel" && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Cancelar {numberFormatter.format(count)}
                </Button>
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="m-2 text-sm font-medium text-danger">
              {error}
            </p>
          )}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <div
      role="region"
      aria-label="Ações em massa"
      className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t border-line-soft bg-surface-2/95 px-4 py-2.5 backdrop-blur-sm"
    >
      <p aria-live="polite" className="mr-2 text-sm font-medium text-fg tabular">
        {countText}
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => run("Complete")}
        className="hover:border-success hover:bg-success/10 hover:text-success"
      >
        {busy === "Complete" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
        Concluir
      </Button>
      {panelButton("reschedule", "Reagendar", <CalendarClock aria-hidden="true" />)}
      {canReassign && panelButton("reassign", "Reatribuir", <UserRoundCog aria-hidden="true" />)}
      {panelButton("cancel", "Cancelar", <Ban aria-hidden="true" />, true)}
      <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={onClear} disabled={disabled}>
        <X aria-hidden="true" />
        Limpar seleção
      </Button>
      {error && panel === null && (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

const panelAction: Record<Panel, BulkTaskAction> = {
  reschedule: "Reschedule",
  reassign: "Reassign",
  cancel: "Cancel",
}
