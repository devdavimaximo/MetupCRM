import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { dueShortcuts, toDateTimeInputValue } from "./task-format"

/**
 * "Reagendar para": atalhos num toque + data/hora livre. O mesmo painel na linha (`⋯`) e na barra
 * de ações em massa.
 */
export function RescheduleForm({
  initial,
  busy,
  onSubmit,
}: {
  /** Valor inicial do campo livre (o prazo atual da tarefa); vazio no lote. */
  initial: Date | null
  busy: boolean
  onSubmit: (dueDate: Date) => void
}) {
  const [freeDate, setFreeDate] = useState(() => (initial ? toDateTimeInputValue(initial) : ""))
  const now = new Date()
  const shortcuts = dueShortcuts(now, "evening")
  const freeDateValue = freeDate ? new Date(freeDate) : null
  const freeDateInPast = freeDateValue !== null && freeDateValue <= now

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (!freeDateValue || freeDateInPast) return
        onSubmit(freeDateValue)
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
            disabled={busy}
            onClick={() => onSubmit(shortcut.date)}
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
      <Button type="submit" size="sm" disabled={busy || !freeDateValue || freeDateInPast}>
        {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
        Reagendar
      </Button>
    </form>
  )
}
