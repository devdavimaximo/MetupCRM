import { useRef, useState } from "react"
import { Ban, CalendarClock, Check, Ellipsis, Loader2, SquareArrowOutUpRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { toMessage } from "@/features/companies/form-errors"
import { cancelTask, completeTask, rescheduleTask, type TaskItem } from "./api"
import { dueShortcuts, toDateTimeInputValue } from "./task-format"
import { taskTitle } from "./task-labels"

type Busy = "complete" | "cancel" | "reschedule" | null

/**
 * As ações de uma tarefa: "Concluir" num clique e o `⋯` com Reagendar (atalhos + data/hora livre),
 * Abrir negócio e Cancelar (com confirmação). Reagendar e cancelar abrem um popover ancorado no `⋯`,
 * então o foco volta para ele ao fechar.
 */
export function TaskActions({
  task,
  onOpenDeal,
  onChanged,
  compact = false,
}: {
  task: TaskItem
  onOpenDeal: (task: TaskItem) => void
  onChanged: (updated: TaskItem) => void
  /** Celular: "Concluir" vira só ícone para caber ao lado do `⋯`. */
  compact?: boolean
}) {
  const [busy, setBusy] = useState<Busy>(null)
  const [panel, setPanel] = useState<"reschedule" | "cancel" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [freeDate, setFreeDate] = useState("")
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

  function openPanel(next: "reschedule" | "cancel") {
    setError(null)
    if (next === "reschedule") setFreeDate(toDateTimeInputValue(new Date(task.dueDate)))
    panelRequested.current = true
    setPanel(next)
  }

  const now = new Date()
  const shortcuts = dueShortcuts(now, "evening")
  const freeDateValue = freeDate ? new Date(freeDate) : null
  const freeDateInPast = freeDateValue !== null && freeDateValue <= now

  const controls = (
    <div className="flex items-center justify-end gap-1">
      {isPending && (
        <Button
          type="button"
          size={compact ? "icon-sm" : "sm"}
          variant="outline"
          aria-label={`Concluir: ${title}`}
          disabled={busy !== null}
          onClick={() => run("complete", () => completeTask(task.id))}
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
                {busy === "cancel" || busy === "reschedule" ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Ellipsis aria-hidden="true" />
                )}
              </Button>
            </DropdownMenuTrigger>
          </PopoverAnchor>
          <DropdownMenuContent
            // O popover abre logo depois; devolver o foco ao ⋯ agora o fecharia na hora.
            onCloseAutoFocus={(event) => {
              if (!panelRequested.current) return
              panelRequested.current = false
              event.preventDefault()
            }}
          >
            {isPending && (
              <DropdownMenuItem onSelect={() => openPanel("reschedule")}>
                <CalendarClock aria-hidden="true" />
                Reagendar
              </DropdownMenuItem>
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
          aria-label={panel === "cancel" ? `Cancelar: ${title}` : `Reagendar: ${title}`}
          role="dialog"
          className="w-72 p-3"
          // O menu que abriu o popover se desmonta logo depois e o foco "sai" por um instante: não é
          // o usuário saindo. Esc e clique fora continuam fechando.
          onFocusOutside={(event) => event.preventDefault()}
          ref={panelRef}
          onOpenAutoFocus={(event) => {
            // O foco automático do Radix acontece antes de o menu se desmontar e se perde; move no quadro seguinte.
            event.preventDefault()
            requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("button:not(:disabled), input")?.focus())
          }}
        >
          {panel === "reschedule" && (
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                if (!freeDateValue || freeDateInPast) return
                void run("reschedule", () => rescheduleTask(task.id, freeDateValue.toISOString()))
              }}
            >
              <p className="text-sm font-medium text-fg">Reagendar para</p>
              <div className="grid grid-cols-2 gap-1.5">
                {shortcuts.map((shortcut) => (
                  <Button
                    key={shortcut.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => run("reschedule", () => rescheduleTask(task.id, shortcut.date.toISOString()))}
                    className="normal-case tracking-normal font-sans text-sm"
                  >
                    {shortcut.label}
                  </Button>
                ))}
              </div>
              <label className="flex flex-col gap-1.5 text-xs text-fg-muted">
                Data e hora
                <Input
                  type="datetime-local"
                  value={freeDate}
                  min={toDateTimeInputValue(now)}
                  onChange={(e) => setFreeDate(e.target.value)}
                  aria-invalid={freeDateInPast || undefined}
                  className="h-9"
                />
              </label>
              {freeDateInPast && <p className="text-xs text-danger">Escolha um horário no futuro.</p>}
              <Button type="submit" size="sm" disabled={busy !== null || !freeDateValue || freeDateInPast}>
                {busy === "reschedule" && <Loader2 className="animate-spin" aria-hidden="true" />}
                Reagendar
              </Button>
            </form>
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
            <p role="alert" className="mt-2 text-sm font-medium text-danger">
              {error}
            </p>
          )}
        </PopoverContent>
      </Popover>

    </div>
  )

  return (
    <div className="flex flex-col items-end gap-1">
      {controls}
      {error && panel === null && (
        <p role="alert" className="max-w-48 text-right text-xs whitespace-normal text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
