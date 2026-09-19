import { useRef, useState } from "react"
import { Ban, CalendarClock, Check, ClipboardPen, Ellipsis, Loader2, SquareArrowOutUpRight, UserRoundCog } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { toMessage } from "@/features/companies/form-errors"
import type { UserSummary } from "@/features/deals/api"
import { cancelTask, completeTask, reassignTask, rescheduleTask, type TaskItem } from "./api"
import { OwnerListbox } from "@/components/OwnerPicker"
import { focusOwnerListbox } from "@/components/owner-listbox"
import { RescheduleForm } from "./RescheduleForm"
import { taskTitle } from "./task-labels"

type Busy = "complete" | "cancel" | "reschedule" | "reassign" | null
type Panel = "reschedule" | "cancel" | "reassign"

export type TaskActionsContext = {
  /** Admin/Closer: o `⋯` ganha "Reatribuir". O servidor recusa o SDR de qualquer jeito (403). */
  canReassign: boolean
  users: UserSummary[]
  onOpenDeal: (task: TaskItem) => void
  /** Abre o registro de atividade que conclui esta tarefa (a folha vive na página). */
  onLogActivity: (task: TaskItem) => void
  onChanged: (updated: TaskItem) => void
}

const panelLabel: Record<Panel, string> = {
  reschedule: "Reagendar",
  cancel: "Cancelar",
  reassign: "Reatribuir",
}

/**
 * As ações de uma tarefa: "Concluir" num clique e o `⋯` completo — Concluir · Reagendar ·
 * Registrar atividade · Reatribuir · Abrir negócio · Cancelar. Reagendar, reatribuir e cancelar abrem
 * um popover ancorado no `⋯`, então o foco volta para ele ao fechar.
 */
export function TaskActions({
  task,
  canReassign,
  users,
  onOpenDeal,
  onLogActivity,
  onChanged,
  compact = false,
}: TaskActionsContext & {
  task: TaskItem
  /** Celular: "Concluir" vira só ícone para caber ao lado do `⋯`. */
  compact?: boolean
}) {
  const [busy, setBusy] = useState<Busy>(null)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Lido no fechamento do menu, que acontece antes de o novo estado chegar ao callback.
  const panelRequested = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const title = taskTitle(task)
  const isPending = task.status === "Pendente"

  async function run(kind: Exclude<Busy, null>, action: () => Promise<TaskItem>) {
    setBusy(kind)
    setError(null)
    try {
      const updated = await action()
      setPanel(null)
      onChanged(updated)
    } catch (err) {
      setError(toMessage(err, "Não foi possível atualizar a tarefa."))
    } finally {
      setBusy(null)
    }
  }

  function openPanel(next: Panel) {
    setError(null)
    panelRequested.current = true
    setPanel(next)
  }

  const complete = () => run("complete", () => completeTask(task.id))

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-1">
        {isPending && (
          <Button
            type="button"
            size={compact ? "icon-sm" : "sm"}
            variant="outline"
            aria-label={`Concluir: ${title}`}
            disabled={busy !== null}
            onClick={complete}
            className="hover:border-success hover:bg-success/10 hover:text-success"
          >
            {busy === "complete" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
            {!compact && "Concluir"}
          </Button>
        )}

        <Popover open={panel !== null} onOpenChange={(open) => !open && setPanel(null)}>
          <DropdownMenu>
            <PopoverAnchor asChild>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="icon-sm" variant="ghost" aria-label={`Mais ações: ${title}`} disabled={busy !== null}>
                  {busy !== null && busy !== "complete" ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Ellipsis aria-hidden="true" />
                  )}
                </Button>
              </DropdownMenuTrigger>
            </PopoverAnchor>
            <DropdownMenuContent
              align="end"
              // O popover abre logo depois; devolver o foco ao ⋯ agora o fecharia na hora.
              onCloseAutoFocus={(event) => {
                if (!panelRequested.current) return
                panelRequested.current = false
                event.preventDefault()
              }}
            >
              {isPending && (
                <>
                  <DropdownMenuItem onSelect={complete}>
                    <Check aria-hidden="true" />
                    Concluir
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openPanel("reschedule")}>
                    <CalendarClock aria-hidden="true" />
                    Reagendar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => onLogActivity(task)}>
                    <ClipboardPen aria-hidden="true" />
                    Registrar atividade
                  </DropdownMenuItem>
                  {canReassign && (
                    <DropdownMenuItem onSelect={() => openPanel("reassign")}>
                      <UserRoundCog aria-hidden="true" />
                      Reatribuir
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onSelect={() => onOpenDeal(task)}>
                <SquareArrowOutUpRight aria-hidden="true" />
                Abrir negócio
              </DropdownMenuItem>
              {isPending && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => openPanel("cancel")} className="data-highlighted:text-danger">
                    <Ban aria-hidden="true" />
                    Cancelar tarefa
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <PopoverContent
            aria-label={panel ? `${panelLabel[panel]}: ${title}` : undefined}
            role="dialog"
            className={panel === "reassign" ? "flex w-72 flex-col p-0" : "w-72 p-3"}
            // O menu que abriu o popover se desmonta logo depois e o foco "sai" por um instante: não é
            // o usuário saindo. Esc e clique fora continuam fechando.
            onFocusOutside={(event) => event.preventDefault()}
            ref={panelRef}
            onOpenAutoFocus={(event) => {
              if (panel === "reassign") return focusOwnerListbox(event, users.length)
              // O foco automático do Radix acontece antes de o menu se desmontar e se perde; move no quadro seguinte.
              event.preventDefault()
              requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("button:not(:disabled), input")?.focus())
            }}
          >
            {panel === "reschedule" && (
              <RescheduleForm
                initial={new Date(task.dueDate)}
                busy={busy !== null}
                onSubmit={(dueDate) => run("reschedule", () => rescheduleTask(task.id, dueDate.toISOString()))}
              />
            )}

            {panel === "reassign" && (
              <>
                <p className="border-b border-line-soft px-3 py-2.5 text-sm font-medium text-fg">Reatribuir para</p>
                <OwnerListbox
                  users={users}
                  selectedKey={task.ownerUserId}
                  label="Novo responsável"
                  onChoose={(ownerUserId) => {
                    if (ownerUserId === task.ownerUserId) return setPanel(null)
                    void run("reassign", () => reassignTask(task.id, ownerUserId))
                  }}
                />
              </>
            )}

            {panel === "cancel" && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-fg">Cancelar esta tarefa? Ela sai da fila e fica no histórico como cancelada.</p>
                <div className="flex justify-end gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setPanel(null)}>
                    Voltar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy !== null}
                    onClick={() => run("cancel", () => cancelTask(task.id))}
                  >
                    {busy === "cancel" && <Loader2 className="animate-spin" aria-hidden="true" />}
                    Cancelar tarefa
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
      </div>
      {error && panel === null && (
        <p role="alert" className="max-w-48 text-right text-xs whitespace-normal text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
